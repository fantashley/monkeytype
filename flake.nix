{
  description = "Monkeytype, packaged for self hosting";

  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      packages = forAllSystems (
        pkgs:
        let
          monkeytype = pkgs.callPackage ./nix/package.nix {
            version = self.lastModifiedDate or "unstable";
            commitHash = self.shortRev or self.dirtyShortRev or "unknown";
          };
        in
        {
          inherit (monkeytype)
            backend
            frontend
            pnpmDeps
            workspace
            ;
          default = monkeytype.backend;
        }
      );

      nixosModules.default = import ./nix/module.nix self;

      formatter = forAllSystems (pkgs: pkgs.nixfmt);
    };
}
