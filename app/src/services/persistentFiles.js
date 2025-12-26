import fs from "fs";
import path from "path";

const persistentTargets = [
    {
        envKey: "ALLOWED_EMAILS_FILE",
        defaultContent: "# Ajoutez une adresse email par ligne\n"
    },
    {
        envKey: "GAME_PRESETS_FILE",
        defaultContent: "[]\n"
    }
];

export function ensurePersistentFiles() {
    persistentTargets.forEach(function ensureFile(target) {
        const configuredPath = process.env[target.envKey];

        if (!configuredPath || typeof configuredPath !== "string") {
            return;
        }

        const trimmedPath = configuredPath.trim();

        if (!trimmedPath) {
            return;
        }

        const resolvedPath = path.resolve(trimmedPath);
        const directory = path.dirname(resolvedPath);

        createDirectoryIfMissing(directory);
        createFileIfMissing(resolvedPath, target.defaultContent);
    });
}

function createDirectoryIfMissing(directoryPath) {
    if (fs.existsSync(directoryPath)) {
        return;
    }

    try {
        fs.mkdirSync(directoryPath, { recursive: true });
    } catch (error) {
        console.error("Impossible de créer le dossier", directoryPath, error.message);
    }
}

function createFileIfMissing(filePath, defaultContent) {
    if (fs.existsSync(filePath)) {
        return;
    }

    try {
        fs.writeFileSync(filePath, defaultContent, "utf-8");
        console.log("Fichier persistant créé", filePath);
    } catch (error) {
        console.error("Impossible de créer le fichier persistant", filePath, error.message);
    }
}
