import * as pulumi from "@pulumi/pulumi";
import * as proxmoxve from "@muhlba91/pulumi-proxmoxve";

const JAMMY_IMAGE_URL =
  "https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img";

export interface UbuntuTemplateArgs {
  nodeName: string;
  vmId: number;
  vmName: string;
  /** Datastore for the VM disk, EFI disk, and cloud-init drive. */
  datastoreId: string;
  /** Datastore that holds the cloud image. Must allow ISO content when downloading. */
  imageDataStoreId: string;
  /**
   * Existing image id, `<datastore>:<content>/<file>`.
   * Used when `downloadImage` is false.
   */
  imageFileId: string;
  /** Download the Jammy cloud image onto `imageDatastoreId` before creating the VM. */
  downloadImage: boolean;
  imageUrl?: string;
  bridge: string;
  memoryMb: number;
  cpuCores: number;
  diskSizeGb: number;
  sshPublicKey: string;
}

/**
 * Ubuntu 22.04 cloud-inmage VM registered as a proxmox template.
 * The image is already generalized, so the VM is not booted before conversion.
 */
export class UbuntuTemplate extends pulumi.ComponentResource {
  public readonly vmId: pulumi.Output<number>;
  public readonly name: pulumi.Output<string>;
  public readonly imageFileId: pulumi.Output<string>;

  constructor(
    name: string,
    args: UbuntuTemplateArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("proxmox:vm:UbuntuTemplate", name, {}, opts);

    const childOpts: pulumi.ComponentResourceOptions = { 
      parent: this,
      provider: opts?.provider,
    };

    const imageFileId = args.downloadImage
      ? this.downloadImage(args, childOpts)
      : pulumi.output(args.imageFileId);

    const vm = new proxmoxve.VmLegacy(
      name,
      {
        name: args.vmName,
        nodeName: args.nodeName,
        vmId: args.vmId,
        description: "Ubuntu 22.04 Jammy cloud-image template",
        tags: ["template", "ubuntu"],
        template: true,
        started: false,
        onBoot: false,
        stopOnDestroy: true,
        bios: "ovmf",
        machine: "q35",
        scsiHardware: "virtio-scsi-pci",
        operatingSystem: { type: "l26" },
        bootOrders: ["scsi0"],
        cpu: {
          cores: args.cpuCores,
          sockets: 1,
          type: "host",
        },
        memory: { dedicated: args.memoryMb },
        efiDisk: {
          datastoreId: args.datastoreId,
          type: "4m",
          fileFormat: "raw",
        },
        disk: [
          {
            datastoreId: args.datastoreId,
            fileId: imageFileId,
            interface: "scsi0",
            size: args.diskSizeGb,
            iothread: true,
            discard: "on",
          },
        ],
        networkDevices: [
          {
            bridge: args.bridge,
            model: "virtio",
            firewall: true,
          },
        ],
        agent: {
          enabled: true,
          type: "virtio",
          // The template stays stopped, so do not block on guest-agent IP lookup.
          waitForIp: { disabled: true }, 
        },
        initialization: {
          datastoreId: args.datastoreId,
          interface: "ide2",
          userAccount: {
            username: "ubuntu",
            keys: [args.sshPublicKey],
          },
        },
      },
      childOpts,
    );

    this.vmId = vm.vmId;
    this.name = vm.name;
    this.imageFileId = imageFileId;
    this.registerOutputs({
      vmId: this.vmId,
      name: this.name,
      imageFileId: this.imageFileId,
    });
  }

  private downloadImage(
    args: UbuntuTemplateArgs,
    opts: pulumi.ComponentResourceOptions
  ): pulumi.Output<string> {
    const image = new proxmoxve.download.File(
      "jammy-cloud-image",
      {
        contentType: "iso",
        datastoreId: args.imageDataStoreId,
        nodeName: args.nodeName,
        url: args.imageUrl ?? JAMMY_IMAGE_URL,
        fileName: "jammy-server-cloudimg-amd64.img",
        overwrite: false,
        overwriteUnmanaged: false,
      },
      opts,
    );

    return pulumi.interpolate`${args.imageDataStoreId}:iso/${image.fileName}`;
  }
}