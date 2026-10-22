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
    set -l entorno
    # Los paquetes fijados no se versionan: si faltan, pi intenta instalarlos al arrancar y sin red no abre.
    if not test -d "$recursos/git/github.com/amosblomqvist/pi-interactive-subagents"; or not test -d "$recursos/npm/node_modules/pi-web-access"
        printf 'Faltan paquetes de .pi (subagentes o web): abro pi sin ellos, sin investigador ni búsqueda web; reinstalalos según .pi/SETUP.md.\n' >&2
        set -fx PI_OFFLINE 1
        set entorno -e PI_OFFLINE=1
    end
    # Sólo las skills del proyecto: las globales no son del tutor y una choca con teach.
    set -l opciones $argv -ns --skill "$recursos/skills"
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
    # Una sesión por carpeta: si pi ya está abierto acá, volver a él en vez de abrir otro sobre la misma sesión.
    set -l sesion pi-learn-(printf '%s' "$PWD" | md5sum | string sub -l 8)
    if set -q argv[1]; and command tmux -L pi-learn has-session -t "=$sesion" 2>/dev/null
        printf 'Ya hay un pi abierto en esta carpeta: vuelvo a ese y no uso «%s»; para usarlo, cerralo antes.\n' "$argv" >&2
    end
    command tmux -L pi-learn -f "$configuracion" new-session -A -s "$sesion" -c "$PWD" $entorno -- pi $opciones
end
