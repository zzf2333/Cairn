#!/usr/bin/env bash
# cairn init — Interactive .cairn/ initialization
#
# Delegates to scripts/cairn-init.sh, which contains the full
# interactive initialization logic. This keeps the two implementations
# in sync without duplication.

cmd_init() {
    # Resolve the init script relative to the CLI directory.
    # In repo layout: cli/ and scripts/ are siblings.
    local init_script
    init_script="$(cd "$CAIRN_CLI_DIR/.." && pwd)/scripts/cairn-init.sh"

    if [ ! -f "$init_script" ]; then
        echo -e "${C_RED}error:${C_RESET} $(msg_err_init_not_found "$init_script")" >&2
        echo -e "$(msg_err_ensure_repo)" >&2
        exit 1
    fi

    exec bash "$init_script" "$@"
}
