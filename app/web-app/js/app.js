(function initialize() {
    const statusElement = document.getElementById("server-status");
    const loginButton = document.getElementById("google-login");
    const gamesList = document.getElementById("games-list");
    const gameForm = document.getElementById("game-form");
    const resetButton = document.getElementById("reset-form");
    const addGameButton = document.getElementById("add-game");
    const closeModalButton = document.getElementById("close-modal");
    const modal = document.getElementById("game-modal");
    const modalTitle = document.getElementById("game-modal-title");

    const apiBaseUrl = window.API_BASE_URL || window.location.origin;
    const state = { games: [] };

    const dependencies = {
        statusElement,
        loginButton,
        gamesList,
        gameForm,
        resetButton,
        addGameButton,
        closeModalButton,
        modal,
        modalTitle,
        apiBaseUrl,
        state
    };

    attachHandlers(dependencies);
    refreshGames(apiBaseUrl, state, gamesList, statusElement, dependencies);
})();

function attachHandlers(deps) {
    deps.loginButton.addEventListener("click", function handleLoginClick() {
        alert("Connexion Google à implémenter (SDK Google Identity)");
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

function refreshGames(apiBaseUrl, state, gamesList, statusElement, deps) {
    fetch(apiBaseUrl + "/api/games")
        .then(function parse(response) {
            return response.json();
        })
        .then(function handle(data) {
            state.games = data.games || [];
            populateAdminList(state, gamesList, apiBaseUrl, statusElement, deps);
        })
        .catch(function handleError(error) {
            console.error(error);
            setStatus(statusElement, "Impossible de récupérer les jeux");
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

        const startButton = document.createElement("button");
        startButton.textContent = "Démarrer";
        startButton.className = "action-start";

        const stopButton = document.createElement("button");
        stopButton.textContent = "Arrêter";
        stopButton.className = "action-stop";

        const editButton = document.createElement("button");
        editButton.textContent = "Modifier";
        editButton.className = "action-edit";

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Supprimer";
        deleteButton.className = "action-delete";

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

function fillForm(game, modal, form, modalTitle) {
    form.dataset.editing = game.id;
    form.elements.id.value = game.id;
    form.elements.name.value = game.name;
    form.elements.serviceId.value = game.serviceId;
    form.elements.coolifyBaseUrl.value = game.coolifyBaseUrl || "";
    form.elements.coolifyToken.value = game.coolifyToken || "";
    form.elements.imageUrl.value = game.imageUrl || "";
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
        instructions: form.elements.instructions.value
    };
}

function deleteGame(apiBaseUrl, gameId, state, listElement, statusElement, deps) {
    fetch(apiBaseUrl + "/api/games/" + gameId, { method: "DELETE" })
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

function toggleGameRowButtons(startButton, stopButton, isDisabled) {
    startButton.disabled = isDisabled;
    stopButton.disabled = isDisabled;
}

function sendServerCommand(apiBaseUrl, gameId, action, statusElement, onComplete) {
    fetch(apiBaseUrl + "/api/server/" + gameId + "/" + action, {
        method: "POST",
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
