function pi-learn --description 'Abre pi en la carpeta actual, dentro de tmux'
    if not command -q pi
        printf 'No se encontró pi en PATH. Revisá .pi/SETUP.md.\n' >&2
        return 127
    end
    # Fish carga conda y otras inicializaciones antes de aceptar órdenes.
    if not set -q PI_SUBAGENT_SHELL_READY_DELAY_MS
        set -fx PI_SUBAGENT_SHELL_READY_DELAY_MS 2500
    end
    if set -q TMUX; and test -n "$TMUX"
        # Ya hay tmux: no anidar servidores ni cambiar la carpeta.
        command pi $argv
        return $status
    end
    if not command -q tmux
        printf 'Falta tmux. Instalalo antes de usar pi-learn.\n' >&2
        return 127
    end
    set -l configuracion "$HOME/Projects/pi-learning/.pi/config/tmux.conf"
    if not test -f "$configuracion"
        printf 'Falta la configuración de tmux: %s\n' "$configuracion" >&2
        return 1
    end
    # Una sesión nueva por invocación: no reutilizar otra carpeta ni perder argumentos.
    command tmux -L pi-learn -f "$configuracion" new-session -c "$PWD" -- pi $argv
end
