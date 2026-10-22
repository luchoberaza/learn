function pi-learn --description 'Abre pi en la carpeta actual, dentro de tmux'
    if not command -q pi
        printf 'No se encontró pi en PATH. Revisá .pi/SETUP.md.\n' >&2
        return 127
    end
    set -l recursos "$HOME/Projects/pi-learning/.pi"
    # Fish con conda ejecuta la orden tipeada aunque llegue a los 0 ms; 300 es margen.
    if not set -q PI_SUBAGENT_SHELL_READY_DELAY_MS
        set -fx PI_SUBAGENT_SHELL_READY_DELAY_MS 300
    end
    # Sólo las skills del proyecto: las globales no son del tutor y una choca con teach.
    set -l opciones -ns --skill "$recursos/skills" $argv
    if set -q TMUX; and test -n "$TMUX"
        # Ya hay tmux: no anidar servidores ni cambiar la carpeta.
        command pi $opciones
        return $status
    end
    if not command -q tmux
        printf 'Falta tmux. Instalalo antes de usar pi-learn.\n' >&2
        return 127
    end
    set -l configuracion "$recursos/config/tmux.conf"
    if not test -f "$configuracion"
        printf 'Falta la configuración de tmux: %s\n' "$configuracion" >&2
        return 1
    end
    # Una sesión nueva por invocación: no reutilizar otra carpeta ni perder argumentos.
    command tmux -L pi-learn -f "$configuracion" new-session -c "$PWD" -- pi $opciones
end
