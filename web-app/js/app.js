(function initialize() {
    const startButton = document.getElementById("start-button");
    const stopButton = document.getElementById("stop-button");
    const statusElement = document.getElementById("server-status");
    const loginButton = document.getElementById("google-login");
    const selector = document.getElementById("game-selector");
    const gamesList = document.getElementById("games-list");
    const gameForm = document.getElementById("game-form");
    const resetButton = document.getElementById("reset-form");

    const apiBaseUrl = window.API_BASE_URL || "http://localhost:4000";
    const state = { games: [], selectedGameId: null };

    attachHandlers({
        startButton,
        stopButton,
        statusElement,
        loginButton,
        selector,
        gamesList,
        gameForm,
        resetButton,
        apiBaseUrl,
        state
    });
    refreshGames(apiBaseUrl, state, selector, gamesList, statusElement);
})();

function attachHandlers(deps) {
    deps.loginButton.addEventListener("click", function handleLoginClick() {
        alert("Connexion Google à implémenter (SDK Google Identity)");
    });

    deps.startButton.addEventListener("click", function handleStartClick() {
        if (!deps.state.selectedGameId) {
            setStatus(deps.statusElement, "Sélectionnez un jeu avant de démarrer");
            return;
        }

        setStatus(deps.statusElement, "Démarrage en cours...");
        toggleButtons(deps.startButton, deps.stopButton, true);
        notifyApi("start", deps);
    });

    deps.stopButton.addEventListener("click", function handleStopClick() {
        if (!deps.state.selectedGameId) {
            setStatus(deps.statusElement, "Sélectionnez un jeu avant d'arrêter");
            return;
        }

        setStatus(deps.statusElement, "Arrêt en cours...");
        toggleButtons(deps.startButton, deps.stopButton, true);
        notifyApi("stop", deps);
    });

    deps.selector.addEventListener("change", function handleSelection(event) {
        deps.state.selectedGameId = event.target.value;
    });

    deps.gameForm.addEventListener("submit", function handleSave(event) {
        event.preventDefault();
        persistGame(deps);
    });

    deps.resetButton.addEventListener("click", function resetForm() {
        deps.gameForm.reset();
        deps.gameForm.dataset.editing = "";
    });
}

function refreshGames(apiBaseUrl, state, selector, gamesList, statusElement) {
    fetch(apiBaseUrl + "/api/games")
        .then(function parse(response) {
            return response.json();
        })
        .then(function handle(data) {
            state.games = data.games || [];
            populateSelector(state, selector);
            populateAdminList(state, gamesList, apiBaseUrl, selector, statusElement);
        })
        .catch(function handleError(error) {
            console.error(error);
            setStatus(statusElement, "Impossible de récupérer les jeux");
        });
}

function populateSelector(state, selector) {
    selector.innerHTML = "";

    state.games.forEach(function appendOption(game, index) {
        const option = document.createElement("option");
        option.value = game.id;
        option.textContent = game.name + " (" + game.id + ")";
        selector.appendChild(option);

        if (index === 0 && !state.selectedGameId) {
            state.selectedGameId = game.id;
            selector.value = game.id;
        }
    });
}

function populateAdminList(state, listElement, apiBaseUrl, selector, statusElement) {
    listElement.innerHTML = "";

    state.games.forEach(function buildRow(game) {
        const listItem = document.createElement("li");
        const title = document.createElement("div");
        title.textContent = game.name;
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = game.id;

        const actions = document.createElement("div");
        actions.className = "game-actions";
        const editButton = document.createElement("button");
        editButton.textContent = "Modifier";
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Supprimer";

        editButton.addEventListener("click", function loadGameInForm() {
            fillForm(game);
        });

        deleteButton.addEventListener("click", function removeGame() {
            deleteGame(apiBaseUrl, game.id, state, selector, listElement, statusElement);
        });

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        listItem.appendChild(title);
        listItem.appendChild(badge);
        listItem.appendChild(actions);
        listElement.appendChild(listItem);
    });
}

function fillForm(game) {
    const form = document.getElementById("game-form");
    form.dataset.editing = game.id;
    form.elements.id.value = game.id;
    form.elements.name.value = game.name;
    form.elements.projectId.value = game.projectId;
    form.elements.serviceId.value = game.serviceId;
    form.elements.coolifyBaseUrl.value = game.coolifyBaseUrl || "";
    form.elements.coolifyToken.value = game.coolifyToken || "";
}

function persistGame(deps) {
    const payload = buildPayloadFromForm(deps.gameForm);
    const isEditing = Boolean(deps.gameForm.dataset.editing);
    const method = isEditing ? "PUT" : "POST";
    const url = isEditing
        ? deps.apiBaseUrl + "/api/games/" + deps.gameForm.dataset.editing
        : deps.apiBaseUrl + "/api/games";

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

            deps.gameForm.reset();
            deps.gameForm.dataset.editing = "";
            setStatus(deps.statusElement, "Jeux mis à jour");
            refreshGames(deps.apiBaseUrl, deps.state, deps.selector, deps.gamesList, deps.statusElement);
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
        projectId: form.elements.projectId.value,
        serviceId: form.elements.serviceId.value,
        coolifyBaseUrl: form.elements.coolifyBaseUrl.value,
        coolifyToken: form.elements.coolifyToken.value
    };
}

function deleteGame(apiBaseUrl, gameId, state, selector, listElement, statusElement) {
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
            refreshGames(apiBaseUrl, state, selector, listElement, statusElement);
        })
        .catch(function handleError(error) {
            console.error(error);
            setStatus(statusElement, "Erreur lors de la suppression");
        });
}

function notifyApi(action, deps) {
    fetch(deps.apiBaseUrl + "/api/server/" + deps.state.selectedGameId + "/" + action, {
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
            setStatus(deps.statusElement, message);
            toggleButtons(deps.startButton, deps.stopButton, false);
        })
        .catch(function handleError(error) {
            console.error(error);
            setStatus(deps.statusElement, "Impossible de joindre l'API");
            toggleButtons(deps.startButton, deps.stopButton, false);
        });
}

function setStatus(statusElement, message) {
    statusElement.textContent = "Statut : " + message;
}

function toggleButtons(startButton, stopButton, isDisabled) {
    startButton.disabled = isDisabled;
    stopButton.disabled = isDisabled;
}
