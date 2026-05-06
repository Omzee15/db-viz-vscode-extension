"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var path = __toESM(require("path"));
function activate(context) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      "db-viz.schemaEditor",
      new DBVizEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false
      }
    )
  );
  const treeProvider = new SchemaFileTreeProvider();
  const treeView = vscode.window.createTreeView("db-viz.fileExplorer", {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/*.{dbml,sql}",
    false,
    false,
    false
  );
  watcher.onDidCreate(() => treeProvider.refresh());
  watcher.onDidDelete(() => treeProvider.refresh());
  watcher.onDidChange(() => treeProvider.refresh());
  context.subscriptions.push(watcher);
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "db-viz.openFile",
      async (item) => {
        const uri = item instanceof SchemaFileItem ? item.resourceUri : item;
        await vscode.commands.executeCommand("vscode.openWith", uri, "db-viz.schemaEditor");
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "db-viz.newFile",
      async (target) => {
        let targetFolder;
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
          validateInput: (v) => v.trim() ? null : "Name cannot be empty"
        });
        if (!name) return;
        const fileUri = vscode.Uri.file(path.join(targetFolder, `${name.trim()}.dbml`));
        const starter = `Table users {
  id integer [pk]
  name varchar
  email varchar [unique]
}
`;
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(starter, "utf8"));
        treeProvider.refresh();
        await vscode.commands.executeCommand("vscode.openWith", fileUri, "db-viz.schemaEditor");
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "db-viz.newFolder",
      async (target) => {
        const parentPath = target?.folderPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
        const name = await vscode.window.showInputBox({
          prompt: "Folder name",
          placeHolder: "schemas",
          validateInput: (v) => v.trim() ? null : "Name cannot be empty"
        });
        if (!name) return;
        await vscode.workspace.fs.createDirectory(
          vscode.Uri.file(path.join(parentPath, name.trim()))
        );
        treeProvider.refresh();
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "db-viz.rename",
      async (item) => {
        const oldUri = item instanceof SchemaFileItem ? item.resourceUri : vscode.Uri.file(item.folderPath);
        const oldName = path.basename(oldUri.fsPath);
        const ext = item instanceof SchemaFileItem ? path.extname(oldName) : "";
        const baseName = item instanceof SchemaFileItem ? path.basename(oldName, ext) : oldName;
        const newBase = await vscode.window.showInputBox({
          prompt: "New name",
          value: baseName,
          validateInput: (v) => v.trim() ? null : "Name cannot be empty"
        });
        if (!newBase || newBase.trim() === baseName) return;
        const newName = item instanceof SchemaFileItem ? `${newBase.trim()}${ext}` : newBase.trim();
        const newUri = vscode.Uri.file(path.join(path.dirname(oldUri.fsPath), newName));
        await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: false });
        treeProvider.refresh();
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "db-viz.deleteFile",
      async (item) => {
        const uri = item.resourceUri;
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
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "db-viz.deleteFolder",
      async (item) => {
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
  context.subscriptions.push(
    vscode.commands.registerCommand("db-viz.refresh", () => treeProvider.refresh())
  );
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
function deactivate() {
}
var SchemaFolderItem = class extends vscode.TreeItem {
  constructor(name, folderPath) {
    super(name, vscode.TreeItemCollapsibleState.Collapsed);
    this.name = name;
    this.folderPath = folderPath;
    this.tooltip = folderPath;
    this.iconPath = new vscode.ThemeIcon("folder");
    this.contextValue = "schemaFolder";
  }
};
var SchemaFileItem = class extends vscode.TreeItem {
  constructor(name, resourceUri) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.name = name;
    this.resourceUri = resourceUri;
    this.tooltip = resourceUri.fsPath;
    this.iconPath = new vscode.ThemeIcon(
      name.toLowerCase().endsWith(".sql") ? "database" : "symbol-class"
    );
    this.contextValue = "schemaFile";
    this.command = {
      command: "db-viz.openFile",
      title: "Open in DB Viz",
      arguments: [this]
    };
  }
};
var SchemaFileTreeProvider = class {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }
  refresh() {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(element) {
    return element;
  }
  async getChildren(element) {
    if (!vscode.workspace.workspaceFolders?.length) return [];
    const rootPath = element ? element.folderPath : vscode.workspace.workspaceFolders[0].uri.fsPath;
    return this.buildChildren(rootPath);
  }
  async buildChildren(dirPath) {
    let entries;
    try {
      entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
    } catch {
      return [];
    }
    const folders = [];
    const files = [];
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
  async folderHasSchemaFiles(dirPath) {
    let entries;
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
};
var DBVizEditorProvider = class {
  constructor(context) {
    this.context = context;
  }
  async resolveCustomTextEditor(document, webviewPanel, _token) {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
        vscode.Uri.joinPath(this.context.extensionUri, "media")
      ]
    };
    webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview,
      document
    );
    const getLayoutKey = (uri) => `layout:${uri.toString()}`;
    const loadLayout = () => {
      return this.context.workspaceState.get(
        getLayoutKey(document.uri)
      ) ?? "";
    };
    const sendUpdate = () => {
      webviewPanel.webview.postMessage({
        type: "init",
        content: document.getText(),
        fileName: path.basename(document.uri.fsPath),
        layoutData: loadLayout()
      });
    };
    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible) sendUpdate();
    });
    let initSent = false;
    const fallbackTimer = setTimeout(() => {
      if (!initSent) {
        initSent = true;
        sendUpdate();
      }
    }, 600);
    webviewPanel.onDidDispose(() => clearTimeout(fallbackTimer));
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          webviewPanel.webview.postMessage({
            type: "update",
            content: document.getText()
          });
        }
      }
    );
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });
    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "ready": {
          initSent = true;
          clearTimeout(fallbackTimer);
          sendUpdate();
          break;
        }
        case "save": {
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            msg.content
          );
          await vscode.workspace.applyEdit(edit);
          await document.save();
          webviewPanel.webview.postMessage({ type: "saved" });
          break;
        }
        case "saveLayout": {
          await this.context.workspaceState.update(
            getLayoutKey(document.uri),
            msg.layoutData
          );
          break;
        }
        case "showError": {
          vscode.window.showErrorMessage(msg.message);
          break;
        }
        case "showInfo": {
          vscode.window.showInformationMessage(msg.message);
          break;
        }
      }
    });
  }
  getHtmlForWebview(webview, _document) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.css")
    );
    const nonce = getNonce();
    return (
      /* html */
      `<!DOCTYPE html>
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
</html>`
    );
  }
};
function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
