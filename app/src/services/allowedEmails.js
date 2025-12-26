import fs from "fs";
import path from "path";

const DEFAULT_FILE_NAME = "allowed-emails.txt";

export function readAllowedEmails(filePath) {
    const resolvedPath = resolveFilePath(filePath);

    if (!resolvedPath) {
        return [];
    }

    try {
        const fileContent = fs.readFileSync(resolvedPath, "utf-8");
        return parseEmailList(fileContent);
    } catch (error) {
        console.error("Failed to read allowed emails file", error.message);
        return [];
    }
}

export function isEmailAllowed(email, filePath) {
    if (!email) {
        return false;
    }

    const allowedEmails = readAllowedEmails(filePath);
    return allowedEmails.includes(email.toLowerCase());
}

function resolveFilePath(customPath) {
    if (customPath && fs.existsSync(customPath)) {
        return customPath;
    }

    const fallbackPath = path.join(process.cwd(), DEFAULT_FILE_NAME);

    if (fs.existsSync(fallbackPath)) {
        return fallbackPath;
    }

    return "";
}

function parseEmailList(rawContent) {
    return rawContent
        .split(/\r?\n/)
        .map(function normalizeLine(line) {
            return line.trim().toLowerCase();
        })
        .filter(function keepNonEmpty(line) {
            return line !== "" && !line.startsWith("#");
        });
}
