Pulumi Components

| File | Purpose |
| :--- | :--- |
| `index.ts`| Stack entry point: reads config, creates the provider and the template |
| `ubuntyTemplate.ts` | The UbuntuTemplate componentthat defines the VM and image |
| `package.json` | Declares @muhlba91/pulumi-proxmoxve, @pulumi/pulumi, TypeScript |
| `package-lock.json` | Pins the exact dependency versions so the new laptop gets the same packages |
| `Pulumi.yaml` | Project name and runtime (Node.js, TypeScript) |
| `Pulumi.dev.yaml` | The dev stack config: endpoint, VM ID, datastores, bridge, sizes |