import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as pulumi from "@pulumi/pulumi";
import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";
import { UbuntuTemplate } from "./ubuntu-template";

// Reqruied once per stack:
// pulumi config set --secret apiToken 'user@realm!tokenid=tokenvalue'

const config = new pulumi.Config();

function expandHome(filePath: string): string {
    if (filePath === "~") {
        return os.homedir();
    }
    if (filePath.startsWith("~/")) {
        return path.join(os.homedir(), filePath.slice(2));
    }
    return filePath;
}

function readTrimmedFile(filePath: string): string {
    const expanded = expandHome(filePath);
    if (!fs.existsSync(expanded)) {
        throw new Error(`File not found: ${expanded}`);
    }
    const contents = fs.readFileSync(expanded, "utf-8").trim();
    if (contents.length === 0) {
        throw new Error(`File is empty: ${expanded}`);
    }
    return contents;
}

const endpoint = config.require("endpoint");
const nodeName = config.get("nodeName") ?? "pve";
const sshNodeAddress = config.get("sshNodeAddress") ?? new URL(endpoint).hostname;
const sshprivatekey = config.getSecret("sshPrivateKey") ?? pulumi.secret(readTrimmedFile(config.require("sshPrivateKeyPath") ?? "~/.ssh/id_ed25519"));

const provider = new proxmoxve.Provider("proxmoxve", {
    endpoint: endpoint,
    apiToken: config.requireSecret("apiToken"),
    insecure: config.getBoolean("insecure") ?? true,
    ssh: {
      username: config.get("sshUsername") ?? "root",
      privatekey: sshprivatekey,
      nodes: [
        {
          name: nodeName,
          address: sshNodeAddress
        }
      ],
    }
});

const template = new UbuntuTemplate(
  "ubuntu-template", 
  {
    nodeName: nodeName,
    vmId: config.getNumber("vmId") ?? 999,
    vmName: config.get("vmName") ?? "ubuntu-template",
    datastoreId: config.get("datastoreId") ?? "local-lvm",
    imageDataStoreId: config.get("imageDataStoreId") ?? "local",
    imageFileId: config.get("imageFileId") ?? "local:iso/jammy-server-cloudimg-amd64.iso",
    downloadImage: config.getBoolean("downloadImage") ?? false,
    imageUrl: config.get("imageUrl"),
    bridge: config.get("bridge") ?? "vmbr0",
    memoryMb: config.getNumber("memoryMb") ?? 2048,
    cpuCores: config.getNumber("cpuCores") ?? 2,
    diskSizeGb: config.getNumber("diskSizeGb") ?? 20,
    sshPublicKey: readTrimmedFile(config.get("sshPublicKeyPath") ?? "~/.ssh/id_ed25519.pub"),
  }, 
  { provider: provider },
);

export const vmId = template.vmId;
export const name = template.name;
export const imageFileId = template.imageFileId;