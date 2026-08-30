SHELL := /bin/sh
.PHONY: preflight prepare build verify require-tooling require-out release attest
SDK_VERSION := 0.0.18

preflight:
	@scripts/check-build-environment.sh

prepare: preflight
	@CI=1 PNPM_DISABLE_SELF_UPDATE_CHECK=1 pnpm install --frozen-lockfile

build: prepare
	@pnpm build

verify: prepare
	@pnpm verify

require-tooling:
	@tool="$$(command -v soksak-sdk)" || { echo 'soksak-sdk is not selected by PATH' >&2; exit 78; }; \
		case "$$tool" in /*) ;; *) echo 'soksak-sdk PATH entry must be absolute' >&2; exit 78 ;; esac; \
		root="$$(cd "$$(dirname "$$tool")/.." && pwd -P)"; \
		test -f "$$tool" && test ! -L "$$tool" && test -f "$$root/release.json" && test ! -L "$$root/release.json" && test -d "$$root/.dependencies/soksak-spec" || { echo 'soksak-sdk PATH entry is not a prepared release' >&2; exit 78; }; \
		package_version="$$(node -e 'process.stdout.write(require(process.argv[1]).version)' "$$root/package.json")"; \
		release_version="$$(node -e 'process.stdout.write(require(process.argv[1]).version)' "$$root/release.json")"; \
		test "$$package_version" = "$(SDK_VERSION)" && test "$$release_version" = "$(SDK_VERSION)" || { echo "TOOLCHAIN_MISMATCH soksak-sdk required=$(SDK_VERSION) package=$$package_version release=$$release_version" >&2; exit 78; }

require-out:
	@case "$(origin OUT)" in "command line") ;; *) echo 'OUT must be an absolute command-line path' >&2; exit 64 ;; esac
	@case "$(OUT)" in /*) ;; *) echo 'OUT must be an absolute path' >&2; exit 64 ;; esac
	@test "$(OUT)" != "$(CURDIR)" || { echo 'OUT must not replace the source repository' >&2; exit 64; }

release: require-tooling require-out verify
	@test -z "$$(git status --porcelain)" || { echo 'release source checkout must be clean' >&2; exit 65; }
	@tool="$$(command -v soksak-sdk)"; tooling_root="$$(cd "$$(dirname "$$tool")/.." && pwd -P)"; \
		soksak-sdk package --root "$(CURDIR)" --spec-root "$$tooling_root/.dependencies/soksak-spec" \
		--commit "$$(git rev-parse --verify HEAD)" --out "$(OUT)"

attest: require-tooling require-out release
	@tool="$$(command -v soksak-sdk)"; tooling_root="$$(cd "$$(dirname "$$tool")/.." && pwd -P)"; \
		soksak-sdk attest --release-dir "$(OUT)" --spec-root "$$tooling_root/.dependencies/soksak-spec" \
		--tooling-release "$$tooling_root/release.json" --mode native \
		--platform "$$(node -p 'process.platform')" --architecture "$$(node -p 'process.arch')" \
		--tool "node=$$(node -p 'process.versions.node')" --tool "pnpm=$$(pnpm --version)"
