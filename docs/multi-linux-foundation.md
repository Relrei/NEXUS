# Multi-Linux shell foundation

This branch introduces the first shared-shell foundation for NEXUS.

- Arch Linux + Hyprland remains the default environment.
- Ubuntu GNOME, Fedora GNOME, and Linux Mint Cinnamon are selectable sessions.
- `/home/user` and the virtual file system remain shared between every session.
- Window state is stored separately for each environment.
- The session chooser is responsive for desktop, tablet, and mobile.
- `Alt + Shift + L` opens the environment chooser.
- The lock screen includes a logout and environment-switch action.
- The application continues to support the single-file HTML build.

This phase intentionally provides the session and storage architecture first. Desktop-specific panels, launchers, keybindings, and visual behavior can be expanded without duplicating user files.
