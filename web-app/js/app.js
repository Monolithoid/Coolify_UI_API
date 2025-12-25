(function initialize() {
    const startButton = document.getElementById("start-button");
    const stopButton = document.getElementById("stop-button");
    const statusElement = document.getElementById("server-status");
    const loginButton = document.getElementById("google-login");

    attachHandlers(startButton, stopButton, statusElement, loginButton);
})();

function attachHandlers(startButton, stopButton, statusElement, loginButton) {
    loginButton.addEventListener("click", function handleLoginClick() {
        alert("Connexion Google à implémenter (SDK Google Identity)");
    });

    startButton.addEventListener("click", function handleStartClick() {
        setStatus(statusElement, "Démarrage en cours...");
        toggleButtons(startButton, stopButton, true);
        notifyApi("start", statusElement, startButton, stopButton);
    });

    stopButton.addEventListener("click", function handleStopClick() {
        setStatus(statusElement, "Arrêt en cours...");
        toggleButtons(startButton, stopButton, true);
        notifyApi("stop", statusElement, startButton, stopButton);
    });
}

function notifyApi(action, statusElement, startButton, stopButton) {
    fetch("http://localhost:4000/api/server/" + action, {
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
            toggleButtons(startButton, stopButton, false);
        })
        .catch(function handleError(error) {
            console.error(error);
            setStatus(statusElement, "Impossible de joindre l'API");
            toggleButtons(startButton, stopButton, false);
        });
}

function setStatus(statusElement, message) {
    statusElement.textContent = "Statut : " + message;
}

function toggleButtons(startButton, stopButton, isDisabled) {
    startButton.disabled = isDisabled;
    stopButton.disabled = isDisabled;
}
