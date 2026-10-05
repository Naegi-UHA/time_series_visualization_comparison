const methodOptions = document.querySelector(".method-options");
const currentMethod = document.getElementById("current-method");

methodOptions.addEventListener("click", (event) => {
    if (event.target.matches("button")) {
        const method = event.target.textContent.trim();
        currentMethod.dataset.method = method.toLowerCase();
        currentMethod.textContent = `current method : ${method}`;
        methodOptions.closest(".method-selector").open = false;
    }
});
