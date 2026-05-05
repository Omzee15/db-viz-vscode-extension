import * as vscode from "vscode";
import * as path from "path";

// ─── Activation ──────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  // ── Custom editor ─────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "db-viz.schemaEditor",
      new DBVizEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  // ── File Tree sidebar ─────────────────────────────────────────────────────
  const treeProvider = new SchemaFileTreeProvider();
  const treeView = vscode.window.createTreeView("db-viz.fileExplorer", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Refresh when .dbml/.sql files change on disk
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/*.{dbml,sql}",
    false, false, false
  );
  watcher.onDidCreate(() => treeProvider.refresh());
  watcher.onDidDelete(() => treeProvider.refresh());
  watcher.onDidChange(() => treeProvider.refresh());
  context.subscriptions.push(watcher);

  // ── Commands ──────────────────────────────────────────────────────────────

  // Open file in DB Viz editor (called by tree item click)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "db-viz.openFile",
      async (item: SchemaFileItem | vscode.Uri) => {
        const uri = item instanceof SchemaFileItem ? item.resourceUri! : item;
        await vscode.commands.executeCommand("vscode.openWith", uri, "db-viz.schemaEditor");
      }
    )
  );

  // New DBML file — from sidebar, explorer context, or command palette
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "db-viz.newFile",
      async (target?: SchemaFolderItem | vscode.Uri) => {
        let targetFolder: string;
        if (target instanceof SchemaFolderItem) {
          targetFolder = target.folderPath;
        } else if (target instanceof vscode.Uri) {
          targetFolder = target.fsPath;
        } else {
          targetFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
        }

        const name = await vscode.window.showInputBox({
          prompt: "File name (without extension)",
          placeHolder: "schema",
          validateInput: (v) => (v.trim() ? null : "Name cannot be empty"),
        });
        if (!name) return;

        const fileUri = vscode.Uri.file(path.join(targetFolder, `${name.trim()}.dbml`));
        const starter = `Table users {\n  id integer [pk]\n  name varchar\n  email varchar [unique]\n}\n`;
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(starter, "utf8"));
        treeProvider.refresh();
        await vscode.commands.executeCommand("vscode.openWith", fileUri, "db-viz.schemaEditor");
      }
    )
  );

  // New folder — from sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "db-viz.newFolder",
      async (target?: SchemaFolderItem) => {
        const parentPath =
          target?.folderPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
        const name = await vscode.window.showInputBox({
          prompt: "Folder name",
          placeHolder: "schemas",
          validateInput: (v) => (v.trim() ? null : "Name cannot be empty"),
        });
        if (!name) return;
        await vscode.workspace.fs.createDirectory(
          vscode.Uri.file(path.join(parentPath, name.trim()))
        );
        treeProvider.refresh();
      }
    )
  );

  // Rename file or folder
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "db-viz.rename",
      async (item: SchemaFileItem | SchemaFolderItem) => {
        const oldUri =
          item instanceof SchemaFileItem
            ? item.resourceUri!
            : vscode.Uri.file(item.folderPath);
        const oldName = path.basename(oldUri.fsPath);
        const ext = item instanceof SchemaFileItem ? path.extname(oldName) : "";
        const baseName = item instanceof SchemaFileItem ? path.basename(oldName, ext) : oldName;

        const newBase = await vscode.window.showInputBox({
          prompt: "New name",
          value: baseName,
          validateInput: (v) => (v.trim() ? null : "Name cannot be empty"),
        });
        if (!newBase || newBase.trim() === baseName) return;

        const newName = item instanceof SchemaFileItem
          ? `${newBase.trim()}${ext}`
          : newBase.trim();
        const newUri = vscode.Uri.file(path.join(path.dirname(oldUri.fsPath), newName));
        await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: false });
        treeProvider.refresh();
      }
    )
  );

  // Delete file
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "db-viz.deleteFile",
      async (item: SchemaFileItem) => {
        const uri = item.resourceUri!;
        const confirm = await vscode.window.showWarningMessage(
          `Delete "${path.basename(uri.fsPath)}"?`,
          { modal: true },
          "Delete"
        );
        if (confirm !== "Delete") return;
        await vscode.workspace.fs.delete(uri);
        treeProvider.refresh();
      }
    )
  );

  // Delete folder
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "db-viz.deleteFolder",
      async (item: SchemaFolderItem) => {
        const confirm = await vscode.window.showWarningMessage(
          `Delete folder "${path.basename(item.folderPath)}" and all its contents?`,
          { modal: true },
          "Delete"
        );
        if (confirm !== "Delete") return;
        await vscode.workspace.fs.delete(vscode.Uri.file(item.folderPath), { recursive: true });
        treeProvider.refresh();
      }
    )
  );

  // Refresh sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand("db-viz.refresh", () => treeProvider.refresh())
  );

  // Open viewer command (from command palette / text editors)
  context.subscriptions.push(
    vscode.commands.registerCommand("db-viz.openViewer", async () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          activeEditor.document.uri,
          "db-viz.schemaEditor"
        );
      } else {
        vscode.window.showInformationMessage(
          "Open a .dbml or .sql file first, then run this command."
        );
      }
    })
  );
}

export function deactivate() {}

// ─── TreeView items ───────────────────────────────────────────────────────────

class SchemaFolderItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly folderPath: string
  ) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = folderPath;
    this.iconPath = new vscode.ThemeIcon("folder");
    this.contextValue = "schemaFolder";
  }
}

class SchemaFileItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public override readonly resourceUri: vscode.Uri
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = resourceUri.fsPath;
    this.iconPath = new vscode.ThemeIcon(
      name.toLowerCase().endsWith(".sql") ? "database" : "symbol-class"
    );
    this.contextValue = "schemaFile";
    this.command = {
      command: "db-viz.openFile",
      title: "Open in DB Viz",
      arguments: [this],
    };
  }
}

type TreeItem = SchemaFolderItem | SchemaFileItem;

// ─── TreeView data provider ───────────────────────────────────────────────────

class SchemaFileTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!vscode.workspace.workspaceFolders?.length) return [];
    const rootPath = element
      ? (element as SchemaFolderItem).folderPath
      : vscode.workspace.workspaceFolders[0].uri.fsPath;
    return this.buildChildren(rootPath);
  }

  private async buildChildren(dirPath: string): Promise<TreeItem[]> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
    } catch {
      return [];
    }

    const folders: SchemaFolderItem[] = [];
    const files: SchemaFileItem[] = [];

    for (const [name, type] of entries) {
      if (name.startsWith(".") || name === "node_modules" || name === "dist") continue;

      if (type === vscode.FileType.Directory) {
        const childPath = path.join(dirPath, name);
        if (await this.folderHasSchemaFiles(childPath)) {
          folders.push(new SchemaFolderItem(name, childPath));
        }
      } else if (type === vscode.FileType.File && /\.(dbml|sql)$/i.test(name)) {
        files.push(new SchemaFileItem(name, vscode.Uri.file(path.join(dirPath, name))));
      }
    }

    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    return [...folders, ...files];
  }

  private async folderHasSchemaFiles(dirPath: string): Promise<boolean> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
    } catch {
      return false;
    }
    for (const [name, type] of entries) {
      if (name.startsWith(".") || name === "node_modules" || name === "dist") continue;
      if (type === vscode.FileType.File && /\.(dbml|sql)$/i.test(name)) return true;
      if (type === vscode.FileType.Directory) {
        if (await this.folderHasSchemaFiles(path.join(dirPath, name))) return true;
      }
    }
    return false;
  }
}

// ─── Custom Editor Provider ──────────────────────────────────────────────────

class DBVizEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
      ],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview,
      document
    );

    // Helper: read persisted layout for this document
    const getLayoutKey = (uri: vscode.Uri) => `layout:${uri.toString()}`;
    const loadLayout = (): string => {
      return (
        this.context.workspaceState.get<string>(
          getLayoutKey(document.uri)
        ) ?? ""
      );
    };

    // Send current state to webview
    const sendUpdate = () => {
      webviewPanel.webview.postMessage({
        type: "init",
        content: document.getText(),
        fileName: path.basename(document.uri.fsPath),
        layoutData: loadLayout(),
      });
    };

    // When webview becomes visible after being hidden, re-send state
    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible) sendUpdate();
    });

    // Fallback: if the webview never posts "ready" (e.g. due to timing),
    // send init after a short delay so the canvas always populates.
    let initSent = false;
    const fallbackTimer = setTimeout(() => {
      if (!initSent) {
        initSent = true;
        sendUpdate();
      }
    }, 600);

    webviewPanel.onDidDispose(() => clearTimeout(fallbackTimer));

    // Listen for document changes from VS Code (e.g. external edits)
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          webviewPanel.webview.postMessage({
            type: "update",
            content: document.getText(),
          });
        }
      }
    );

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    // Handle messages from the webview
    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "ready": {
          // Webview React app has mounted and is ready — send initial state
          initSent = true;
          clearTimeout(fallbackTimer);
          sendUpdate();
          break;
        }
        case "save": {
          // Apply the edit to the document
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            msg.content as string
          );
          await vscode.workspace.applyEdit(edit);
          await document.save();
          webviewPanel.webview.postMessage({ type: "saved" });
          break;
        }
        case "saveLayout": {
          await this.context.workspaceState.update(
            getLayoutKey(document.uri),
            msg.layoutData as string
          );
          break;
        }
        case "showError": {
          vscode.window.showErrorMessage(msg.message as string);
          break;
        }
        case "showInfo": {
          vscode.window.showInformationMessage(msg.message as string);
          break;
        }
      }
    });
  }

  private getHtmlForWebview(
    webview: vscode.Webview,
    _document: vscode.TextDocument
  ): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.css")
    );
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             script-src 'nonce-${nonce}';
             style-src ${webview.cspSource} 'unsafe-inline';
             img-src ${webview.cspSource} data: blob:;
             font-src ${webview.cspSource};" />
  <title>DB Viz</title>
  <link rel="stylesheet" href="${styleUri}" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; overflow: hidden; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
