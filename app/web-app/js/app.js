(function initialize() {
    const statusElement = document.getElementById("server-status");
    const authStatus = document.getElementById("auth-status");
    const googleButtonContainer = document.getElementById("google-login-container");
    const logoutButton = document.getElementById("google-logout");
    const authUser = document.getElementById("auth-user");
    const gamesList = document.getElementById("games-list");
    const gameForm = document.getElementById("game-form");
    const resetButton = document.getElementById("reset-form");
    const addGameButton = document.getElementById("add-game");
    const closeModalButton = document.getElementById("close-modal");
    const modal = document.getElementById("game-modal");
    const modalTitle = document.getElementById("game-modal-title");
    const adminSection = document.querySelector(".admin");

    const apiBaseUrl = window.API_BASE_URL || window.location.origin;
    const state = {
        games: [],
        user: null,
        authConfig: null,
        googleButtonReady: false,
        codeClient: null
    };

    const dependencies = {
        statusElement,
        authStatus,
        googleButtonContainer,
        logoutButton,
        authUser,
        gamesList,
        gameForm,
        resetButton,
        addGameButton,
        closeModalButton,
        modal,
        modalTitle,
        adminSection,
        apiBaseUrl,
        state
    };

    attachHandlers(dependencies);
    initializeAuthentication(dependencies);
})();

function attachHandlers(deps) {
    deps.logoutButton.addEventListener("click", function handleLogoutClick() {
        performLogout(deps);
    });

    deps.addGameButton.addEventListener("click", function openCreationModal() {
        openModal(deps.modal, deps.modalTitle, "Ajouter un jeu");
        clearForm(deps.gameForm);
    });

    deps.gameForm.addEventListener("submit", function handleSave(event) {
        event.preventDefault();
        persistGame(deps);
    });

    deps.resetButton.addEventListener("click", function resetForm() {
        clearForm(deps.gameForm);
    });

    deps.closeModalButton.addEventListener("click", function handleCloseModal() {
        closeModal(deps.modal, deps.gameForm);
    });

    deps.modal.addEventListener("click", function handleBackdropClick(event) {
        if (event.target === deps.modal) {
            closeModal(deps.modal, deps.gameForm);
        }
    });
}

function initializeAuthentication(deps) {
    markAdminLocked(deps, true);
    updateAuthStatus(deps.authStatus, "Connexion requise");
    hideLogoutButton(deps.logoutButton);

    fetchAuthConfiguration(deps)
        .then(function afterConfig() {
            return setupGoogleLogin(deps).then(function afterButton() {
                return verifyExistingSession(deps);
            });
        })
        .catch(function handleConfigError(error) {
            console.error(error);
            updateAuthStatus(deps.authStatus, "Configuration Google manquante");
        });
}

function fetchAuthConfiguration(deps) {
    return fetch(deps.apiBaseUrl + "/api/auth/config", { credentials: "include" })
        .then(function parse(response) {
            return response.json();
        })
        .then(function storeConfig(data) {
            deps.state.authConfig = data;

            if (!data.clientId) {
                updateAuthStatus(deps.authStatus, "Client Google non configuré");
                throw new Error("Google client id missing");
            }

            if (!data.redirectUri) {
                updateAuthStatus(deps.authStatus, "Redirect URI manquante");
                throw new Error("Google redirect uri missing");
            }
        });
}

function verifyExistingSession(deps) {
    return fetch(deps.apiBaseUrl + "/api/auth/session", { credentials: "include" })
        .then(function handleSession(response) {
            if (response.status >= 400) {
                throw new Error("Session absente");
            }

            return response.json();
        })
        .then(function handleUser(data) {
            deps.state.user = data.user;
            onAuthenticated(deps, "Session restaurée");
        })
        .catch(function handleMissingSession(error) {
            console.info("No active session", error.message);
            markAdminLocked(deps, true);
        });
}

function setupGoogleLogin(deps) {
    if (deps.state.googleButtonReady) {
        return Promise.resolve();
    }

    if (!deps.state.authConfig || !deps.state.authConfig.clientId) {
        updateAuthStatus(deps.authStatus, "Client Google non configuré");
        return Promise.reject(new Error("Client Google non configuré"));
    }

    return waitForGoogleSdk()
        .then(function initializeButton() {
            deps.state.codeClient = window.google.accounts.oauth2.initCodeClient({
                client_id: deps.state.authConfig.clientId,
                scope: "openid email profile",
                ux_mode: "popup",
                redirect_uri: deps.state.authConfig.redirectUri,
                callback: function handleCodeResponse(response) {
                    if (response.error) {
                        updateAuthStatus(deps.authStatus, "Connexion Google annulée");
                        return;
                    }

                    submitAuthCodeToServer(response.code, deps);
                }
            });

            renderGoogleButton(deps.googleButtonContainer, deps.state.codeClient);
            deps.state.googleButtonReady = true;
        })
        .catch(function handleSdkError(error) {
            console.error(error);
            updateAuthStatus(deps.authStatus, "SDK Google indisponible");
        });
}

function renderGoogleButton(container, codeClient) {
    container.innerHTML = "";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "google-badge-button";

    const badge = document.createElement("img");
    badge.src = "https://developers.google.com/identity/images/btn_google_signin_dark_normal_web.png";
    badge.alt = "Se connecter avec Google";

    button.appendChild(badge);

    button.addEventListener("click", function requestAuthCode() {
        codeClient.requestCode();
    });

    container.appendChild(button);
}

function submitAuthCodeToServer(code, deps) {
    fetch(deps.apiBaseUrl + "/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
    })
        .then(function parse(response) {
            return response.json().then(function attachStatus(body) {
                return { status: response.status, body };
            });
        })
        .then(function handleResult(result) {
            if (result.status >= 400) {
                updateAuthStatus(deps.authStatus, result.body.message || "Connexion refusée");
                return;
            }

            deps.state.user = result.body.user;
            onAuthenticated(deps, result.body.message || "Connecté");
        })
        .catch(function handleError(error) {
            console.error(error);
            updateAuthStatus(deps.authStatus, "Erreur pendant la connexion");
        });
}

function onAuthenticated(deps, message) {
    updateAuthStatus(deps.authStatus, message);
    deps.logoutButton.disabled = false;
    markAdminLocked(deps, false);
    hideGoogleButton(deps.googleButtonContainer);
    showLogoutButton(deps.logoutButton);
    updateUserBadge(deps.authUser, deps.state.user);
    refreshGames(deps.apiBaseUrl, deps.state, deps.gamesList, deps.statusElement, deps);
}

function performLogout(deps) {
    fetch(deps.apiBaseUrl + "/api/auth/logout", { method: "POST", credentials: "include" })
        .finally(function afterLogout() {
            deps.state.user = null;
            deps.state.games = [];
            deps.gamesList.innerHTML = "";
            deps.logoutButton.disabled = true;
            updateUserBadge(deps.authUser, null);
            markAdminLocked(deps, true);
            updateAuthStatus(deps.authStatus, "Déconnecté");
            setStatus(deps.statusElement, "Connectez-vous pour gérer les jeux");
            showGoogleButton(deps.googleButtonContainer);
            hideLogoutButton(deps.logoutButton);
        });
}

function waitForGoogleSdk() {
    return new Promise(function waitForReady(resolve, reject) {
        var attempts = 0;

        function verify() {
            var sdkReady = window.google && window.google.accounts && window.google.accounts.id;

            if (sdkReady) {
                resolve();
                return;
            }

            attempts += 1;

            if (attempts > 20) {
                reject(new Error("SDK Google introuvable"));
                return;
            }

            setTimeout(verify, 200);
        }

        verify();
    });
}

function hideGoogleButton(container) {
    if (!container) {
        return;
    }

    container.classList.add("hidden");
}

function showGoogleButton(container) {
    if (!container) {
        return;
    }

    container.classList.remove("hidden");
}

function hideLogoutButton(button) {
    if (!button) {
        return;
    }

    button.classList.add("hidden");
}

function showLogoutButton(button) {
    if (!button) {
        return;
    }

    button.classList.remove("hidden");
}

function refreshGames(apiBaseUrl, state, gamesList, statusElement, deps) {
    if (!state.user) {
        setStatus(statusElement, "Authentification requise");
        return;
    }

    fetch(apiBaseUrl + "/api/games", { credentials: "include" })
        .then(function parse(response) {
            if (response.status === 401 || response.status === 403) {
                throw new Error("Non autorisé");
            }

            return response.json();
        })
        .then(function handle(data) {
            state.games = data.games || [];
            populateAdminList(state, gamesList, apiBaseUrl, statusElement, deps);
        })
        .catch(function handleError(error) {
            console.error(error);
            setStatus(statusElement, "Impossible de récupérer les jeux");
            markAdminLocked(deps, true);
        });
}

function populateAdminList(state, listElement, apiBaseUrl, statusElement, deps) {
    listElement.innerHTML = "";

    state.games.forEach(function buildRow(game) {
        const listItem = document.createElement("li");
        const illustration = document.createElement("img");
        illustration.className = "game-visual";
        illustration.src = game.imageUrl || buildPlaceholderImage(game.name);
        illustration.alt = "Illustration " + game.name;

        const meta = document.createElement("div");
        const title = document.createElement("div");
        title.textContent = game.name;
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = game.id;

        const actions = document.createElement("div");
        actions.className = "game-actions";

        const startButton = createIconButton("▶️", "Démarrer", "action-start");
        const stopButton = createIconButton("⏹️", "Arrêter", "action-stop");
        const editButton = createIconButton("⚙️", "Modifier", "action-edit");
        const deleteButton = createIconButton("🗑️", "Supprimer", "action-delete");

        startButton.addEventListener("click", function triggerStart() {
            setStatus(statusElement, "Démarrage de " + game.name + "...");
            toggleGameRowButtons(startButton, stopButton, true);
            sendServerCommand(apiBaseUrl, game.id, "start", statusElement, function reenable() {
                toggleGameRowButtons(startButton, stopButton, false);
            });
        });

        stopButton.addEventListener("click", function triggerStop() {
            setStatus(statusElement, "Arrêt de " + game.name + "...");
            toggleGameRowButtons(startButton, stopButton, true);
            sendServerCommand(apiBaseUrl, game.id, "stop", statusElement, function reenable() {
                toggleGameRowButtons(startButton, stopButton, false);
            });
        });

        editButton.addEventListener("click", function loadGameInForm() {
            fillForm(game, deps.modal, deps.gameForm, deps.modalTitle);
        });

        deleteButton.addEventListener("click", function removeGame() {
            deleteGame(apiBaseUrl, game.id, state, listElement, statusElement, deps);
        });

        actions.appendChild(startButton);
        actions.appendChild(stopButton);
        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        meta.appendChild(title);
        meta.appendChild(badge);
        listItem.appendChild(illustration);
        listItem.appendChild(meta);
        listItem.appendChild(actions);
        listElement.appendChild(listItem);
    });
}

function createIconButton(symbol, label, className) {
    const button = document.createElement("button");
    button.className = className + " icon-button";
    button.textContent = symbol;
    button.setAttribute("aria-label", label);
    button.title = label;
    return button;
}

function fillForm(game, modal, form, modalTitle) {
    form.dataset.editing = game.id;
    form.elements.id.value = game.id;
    form.elements.name.value = game.name;
    form.elements.serviceId.value = game.serviceId;
    form.elements.coolifyBaseUrl.value = game.coolifyBaseUrl || "";
    form.elements.coolifyToken.value = game.coolifyToken || "";
    form.elements.imageUrl.value = game.imageUrl || "";
    form.elements.discordChannel.value = game.discordChannel || "";
    form.elements.instructions.value = game.instructions || "";
    openModal(modal, modalTitle, "Modifier : " + game.name);
}

function persistGame(deps) {
    const payload = buildPayloadFromForm(deps.gameForm);
    const isEditing = Boolean(deps.gameForm.dataset.editing);
    let method = "POST";
    let url = deps.apiBaseUrl + "/api/games";

    if (isEditing) {
        method = "PUT";
        url = deps.apiBaseUrl + "/api/games/" + deps.gameForm.dataset.editing;
    }

    fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
        .then(function parse(response) {
            return response.json().then(function attachStatus(body) {
                return { status: response.status, body };
            });
        })
        .then(function handle(result) {
            if (result.status >= 400) {
                setStatus(deps.statusElement, result.body.message || "Erreur lors de l'enregistrement");
                return;
            }

            closeModal(deps.modal, deps.gameForm);
            setStatus(deps.statusElement, "Jeux mis à jour");
            refreshGames(deps.apiBaseUrl, deps.state, deps.gamesList, deps.statusElement, deps);
        })
        .catch(function handleError(error) {
            console.error(error);
            setStatus(deps.statusElement, "Impossible de sauvegarder le jeu");
        });
}

function buildPayloadFromForm(form) {
    return {
        id: form.elements.id.value,
        name: form.elements.name.value,
        serviceId: form.elements.serviceId.value,
        coolifyBaseUrl: form.elements.coolifyBaseUrl.value,
        coolifyToken: form.elements.coolifyToken.value,
        imageUrl: form.elements.imageUrl.value,
        discordChannel: form.elements.discordChannel.value,
        instructions: form.elements.instructions.value
    };
}

function deleteGame(apiBaseUrl, gameId, state, listElement, statusElement, deps) {
    fetch(apiBaseUrl + "/api/games/" + gameId, { method: "DELETE", credentials: "include" })
        .then(function parse(response) {
            return response.json().then(function attachStatus(body) {
                return { status: response.status, body };
            });
        })
        .then(function handle(result) {
            if (result.status >= 400) {
                setStatus(statusElement, result.body.message || "Suppression impossible");
                return;
            }

            setStatus(statusElement, "Jeu supprimé");
            refreshGames(apiBaseUrl, state, listElement, statusElement, deps);
        })
        .catch(function handleError(error) {
            console.error(error);
            setStatus(statusElement, "Erreur lors de la suppression");
        });
}

function buildPlaceholderImage(label) {
    const text = encodeURIComponent(label || "jeu");
    return "https://placehold.co/300x200?text=" + text;
}

function setStatus(statusElement, message) {
    statusElement.textContent = "Statut : " + message;
}

function updateAuthStatus(statusElement, message) {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = "Statut : " + message;
}

function updateUserBadge(container, user) {
    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!user) {
        container.classList.add("hidden");
        return;
    }

    const avatar = document.createElement("img");
    avatar.alt = "Avatar utilisateur";
    avatar.src = user.picture || "https://placehold.co/80x80?text=User";

    const meta = document.createElement("div");
    const name = document.createElement("div");
    name.textContent = user.name || "Utilisateur";
    const email = document.createElement("div");
    email.textContent = user.email || "";
    email.className = "badge";

    meta.appendChild(name);
    meta.appendChild(email);
    container.appendChild(avatar);
    container.appendChild(meta);
    container.classList.remove("hidden");
}

function markAdminLocked(deps, isLocked) {
    if (!deps.adminSection) {
        return;
    }

    if (isLocked) {
        deps.adminSection.classList.add("locked");
        deps.addGameButton.disabled = true;
    } else {
        deps.adminSection.classList.remove("locked");
        deps.addGameButton.disabled = false;
    }
}

function toggleGameRowButtons(startButton, stopButton, isDisabled) {
    startButton.disabled = isDisabled;
    stopButton.disabled = isDisabled;
}

function sendServerCommand(apiBaseUrl, gameId, action, statusElement, onComplete) {
    fetch(apiBaseUrl + "/api/server/" + gameId + "/" + action, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "X-Requested-With": "client-web"
        },
        body: JSON.stringify({ source: "web-app" })
    })
        .then(function handleResponse(response) {
            return response.json();
        })
        .then(function handleData(data) {
            const message = data.message || "Réponse inconnue";
            setStatus(statusElement, message);
        })
        .catch(function handleError(error) {
            console.error(error);
            setStatus(statusElement, "Impossible de joindre l'API");
        })
        .finally(function completeAction() {
            if (typeof onComplete === "function") {
                onComplete();
            }
        });
}

function openModal(modal, modalTitle, title) {
    if (modalTitle) {
        modalTitle.textContent = title;
    }

    modal.classList.remove("hidden");
}

function closeModal(modal, form) {
    clearForm(form);
    modal.classList.add("hidden");
}

function clearForm(form) {
    form.reset();
    form.dataset.editing = "";
}
