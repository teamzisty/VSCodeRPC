// Purpose: The main file for the extension, containing the RPC init function, logging functions, and the RPC update function.
// This file is responsible for initializing the extension and updating the RPC.

//Import the necessary modules
import {
  ExtensionContext,
  window,
  workspace,
  TextDocument,
  version,
  commands,
  ConfigurationTarget,
  l10n,
} from "vscode";
import { extname, basename } from "path";
import { Client } from "@xhayper/discord-rpc";
import axios from "axios";

let rpc = new Client({
  clientId:
    workspace.getConfiguration("vscoderpc").get("clientId") ||
    "1317390673556803666",
});

//Idle checker
let date = new Date();
let idle = false;

//Discord RPC init function
/**
 * @param {ExtensionContext} context
 */
export async function init(context: ExtensionContext) {
  //Log that the extension is started
  logInfo("[util.ts : init()] Registering events and commands.");

  //Register the events and commands
  registerEvents(context);
  registerCommands(context);

  const message = window.showInformationMessage(
    l10n.t(
      "The default client ID for Discord RPC has changed. Press copy to get the new ID."
    ),
    l10n.t("Copy")
  );
  message.then(async (value) => {
    if (value == "Copy" || value == "コピー") {
      const clipboard = (await import("clipboardy")).default;
      clipboard.writeSync("1317390673556803666");
    }
  });

  //Log that the extension is activated
  logInfo("[util.ts : init()] Login to Discord RPC, and update the RPC.");
  await rpc.login().then(() => {
    //Log that the extension is logged in to Discord RPC
    logInfo("[util.ts : init()] Logged in to Discord RPC...");
    setTimeout(function () {
      //Update the RPC after 2 seconds
      updateRPC(window.activeTextEditor?.document);

      //Log that the extension is activated
      logInfo("[util.ts : init()] Activate completed!");
    }, 2000);
  });
}

//Logging functions
export function logInfo(message: string) {
  console.log(`[INFO ${new Date()}] ${message}`);
}

function logError(message: string) {
  console.error(`[ERROR ${new Date()}] ${message}`);
}

//Update RPC
async function updateRPC(vscodeTextDocument: TextDocument | undefined) {
  try {
    const configuration = workspace.getConfiguration("vscoderpc");
    if (vscodeTextDocument?.fileName && !configuration.get("privateMode")) {
      //If the file is not empty and private mode is not enabled
      rpc.user?.setActivity({
        details: workspace.name
          ? l10n.t(`In workspace {0}.`, workspace.name)
          : l10n.t(`There is no active workspace.`),
        state: l10n.t(
          `Editing file {0}.`,
          basename(vscodeTextDocument.fileName)
        ),
        startTimestamp: date,
        largeImageKey: (await getExtensionIconURL()) || "vscode",
        largeImageText: `Extension: ${vscodeTextDocument.languageId}`,
      });
    } else if (
      vscodeTextDocument?.fileName &&
      !configuration.get("privateMode")
    ) {
      //If the file is empty and private mode is not enabled
      rpc.user?.setActivity({
        details: workspace.name
          ? l10n.t(`In workspace {0}.`, workspace.name)
          : l10n.t(`There is no active workspace.`),
        state: l10n.t(`There are no active files.`),
        startTimestamp: date,
        largeImageKey: "vscode",
        largeImageText: `Visual Studio Code v${version}`,
      });
    } else {
      //If private mode is enabled
      rpc.user?.setActivity({
        state: l10n.t(`Private mode is enabled.`),
        startTimestamp: date,
        largeImageKey: "vscode",
        largeImageText: `Visual Studio Code v${version}`,
      });
    }
  } catch (e: any) {
    //If there is an error, log it and show an error message
    logError(e);
    if (e.toString().includes("reading 'fileName")) {
      rpc.user?.setActivity({
        details: workspace.name
          ? l10n.t(`In workspace {0}.`, workspace.name)
          : l10n.t(`There is no active workspace.`),
        state: l10n.t(`There are no active files.`),
        startTimestamp: date,
        largeImageKey: "vscode",
        largeImageText: `Visual Studio Code v${version}`,
      });
      return;
    }
    const result = await window.showErrorMessage(
      l10n.t("Error during Discord RPC connection: {0}", e.name),
      l10n.t("Reconnect")
    );
    if (result === "Reconnect") {
      //If the user clicks "Reconnect", reconnect the RPC
      commands.executeCommand("vscoderpc.reconnectrpc");
      logInfo("Error -> Reconnected");
    }
  }
}

//Not focused RPC
async function notFocusedRPC() {
  try {
    if (window.activeTextEditor?.document.fileName) {
      //If the file is not empty and private mode is not enabled
      rpc.user?.setActivity({
        details: workspace.name
          ? l10n.t(`In workspace {0}.`, workspace.name)
          : l10n.t(`There is no active workspace.`),
        state: l10n.t(
          `Away from the window. (File: {0})`,
          basename(window.activeTextEditor?.document.fileName)
        ),
        startTimestamp: date,
        smallImageKey: "idle",
        smallImageText: "Away",
        largeImageKey: (await getExtensionIconURL()) || "vscode",
        largeImageText: `Extension: ${window.activeTextEditor?.document.languageId}`,
      });
    } else {
      //If the file is empty and private mode is not enabled
      rpc.user?.setActivity({
        details: workspace.name
          ? l10n.t(`In workspace {0}.`, workspace.name)
          : l10n.t(`There is no active workspace.`),
        state: l10n.t(`Away from the window. (No active files.)`),
        startTimestamp: date,
        smallImageKey: "idle",
        smallImageText: "Away",
        largeImageKey: "vscode",
        largeImageText: `Visual Studio Code v${version}`,
      });
    }
    //Log the RPC update
    logInfo("--RPC Update--");
    logInfo(`mode: idle`);
    logInfo(`date: ${date}`);
    logInfo("==RPC Update==");
  } catch (e: any) {
    //If there is an error, log it and show an error message
    logError(e);
    const result = await window.showErrorMessage(
      l10n.t("Error during Discord RPC connection: {0}", e.name),
      l10n.t("Reconnect")
    );
    if (result === "Reconnect") {
      //If the user clicks "Reconnect", reconnect the RPC
      commands.executeCommand("vscoderpc.reconnectrpc");
      logInfo("Error -> Reconnected");
    }
  }
}

//Register Commands
async function registerCommands(context: ExtensionContext) {
  //Start RPC
  let startRPC = commands.registerCommand("vscoderpc.startrpc", async () => {
    try {
      //Destroy the current RPC
      rpc = new Client({
        clientId:
          workspace.getConfiguration("vscoderpc").get("clientId") ||
          "1317390673556803666",
      });

      //Set the date to the current date
      date = new Date();

      //Login to the RPC
      await rpc.login().then(() => {
        updateRPC(window.activeTextEditor?.document);
      });
      window.showInformationMessage(l10n.t("RPC has been initiated."));
    } catch (e: any) {
      //If there is an error, log it and show an error message
      logError(e);
      const result = await window.showErrorMessage(
        l10n.t("Error during Discord RPC connection: {0}", e.name),
        l10n.t("Reconnect")
      );
      if (result === "Reconnect") {
        //If the user clicks "Reconnect", reconnect the RPC
        commands.executeCommand("vscoderpc.reconnectrpc");
        logInfo("Error -> Reconnected");
      }
    }
  });

  //Stop RPC
  let stopRPC = commands.registerCommand("vscoderpc.stoprpc", () => {
    //Destroy the current RPC
    rpc.destroy();
    window.showInformationMessage(l10n.t("RPC has been stopped."));
  });

  //Reload RPC
  let reloadRPC = commands.registerCommand(
    "vscoderpc.reconnectrpc",
    async () => {
      try {
        //Destroy the current RPC
        rpc.destroy();

        //Create a new RPC
        rpc = new Client({
          clientId:
            workspace.getConfiguration("vscoderpc").get("clientId") || "",
        });

        //Set the date to the current date
        date = new Date();

        //Login to the RPC
        await rpc.login().then(() => {
          updateRPC(window.activeTextEditor?.document);
        });
        window.showInformationMessage(l10n.t("RPC has been reconnected."));
        logInfo("RPC reconnected.");
      } catch (e: any) {
        //If there is an error, log it and show an error message
        logError(e);
        const result = await window.showErrorMessage(
          l10n.t("Error during Discord RPC connection: {0}", e.name),
          l10n.t("Reconnect")
        );
        if (result === "Reconnect") {
          //If the user clicks "Reconnect", reconnect the RPC
          commands.executeCommand("vscoderpc.reconnectrpc");
          logInfo("Error -> Reconnected");
        }
      }
    }
  );

  //Toggle Private Mode
  let togglePrivate = commands.registerCommand(
    "vscoderpc.toggleprivate",
    async () => {
      try {
        const configuration = workspace.getConfiguration("vscoderpc");
        if (configuration.get("privateMode")) {
          await workspace
            .getConfiguration()
            .update("vscoderpc.privateMode", false, ConfigurationTarget.Global);
        } else {
          await workspace
            .getConfiguration()
            .update("vscoderpc.privateMode", true, ConfigurationTarget.Global);
          await commands.executeCommand("vscoderpc.reconnectrpc");
        }
      } catch (e: any) {
        logError(e);
        await window.showErrorMessage(
          l10n.t("Error during Toggle Private Mode: {0}", e.name)
        );
      }
    }
  );

  //Push the commands to the context
  context.subscriptions.push(startRPC, stopRPC, reloadRPC, togglePrivate);
}

//Register Events
function registerEvents(context: ExtensionContext) {
  //On file changed
  const onFileChanged = workspace.onDidOpenTextDocument(async (ev) => {
    updateRPC(ev);
  });

  //On window state changed
  const onWindowStateChanged = window.onDidChangeWindowState(async (ev) => {
    if (!workspace.getConfiguration("vscoderpc").get("privateMode")) {
      //If private mode is not enabled
      if (ev.focused && idle) {
        //If the window is focused and the RPC is idle
        idle = false;
        updateRPC(window.activeTextEditor?.document);
      } else {
        //If the window is not focused and the RPC is not idle
        idle = true;
        notFocusedRPC();
      }
    }
  });

  //Push the events to the context
  context.subscriptions.push(onFileChanged, onWindowStateChanged);
  //Log the event registration
  logInfo("Event listeners have been registered.");
}

async function getExtensionIconURL(): Promise<string | undefined> {
  return axios
    .get(
      `https://raw.githubusercontent.com/LeonardSSH/vscord/main/assets/icons/${extname(
        window.activeTextEditor?.document.uri.fsPath || "plaintext"
      ).replace(".", "")}.png`
    )
    .then((res) => {
      return `https://raw.githubusercontent.com/LeonardSSH/vscord/main/assets/icons/${extname(
        window.activeTextEditor?.document.uri.fsPath || "plaintext"
      ).replace(".", "")}.png`;
    })
    .catch(() => {
      return "https://raw.githubusercontent.com/LeonardSSH/vscord/main/assets/icons/text.png";
    });
}
