import initSections, { goToSection } from "../sections";
import { allCardDataBase, UniqCard } from "../cards";

import initClient from "./thirdWebClient";
import initPrivateKey, {
  generateNewPrivateKey,
  setPrivateKey,
  getPublicKey,
} from "./keys";
import { checkFile, setFile, getDeckContent, saveFile } from "./mu";
import initUI, {
  showPrivateKey,
  showPrivateKeyError,
  hidePrivateKeyError,
  renderCharacterList,
  setCardsInputValue,
  renderDeckIngredients,
  setCharacterName,
} from "./ui";

const hasOpener = Boolean(window.opener);

const rootURL = hasOpener
  ? "https://js13kgames.com/games/brewing-disaster/index.html"
  : window.location.origin;

(async () => {
  initClient(
    "l1SCueVB2ZCvJm-c-x2JnWdCygpjiSq3MZa3QPCm2tfQokZe0pH8W-ntr_nDLXzkiz6Ak7NqshYAxW_7o7IrJw"
  );

  const privateKey = await initPrivateKey();

  async function checkPrivateKey(onCheckFail: () => void) {
    const publicKey = await getPublicKey();
    const isOK = await checkFile(publicKey);

    if (isOK) {
      goToSection("list");
    } else {
      setPrivateKey("");
      onCheckFail();
    }
  }

  let editedName: string;
  let editedCards: string;

  const isEdit = () => Boolean(editedName) && Boolean(editedCards);

  initUI({
    allIngredients: allCardDataBase.map(({ id }) => new UniqCard(id)),
    async onPrivateKeyEnter(key) {
      hidePrivateKeyError();

      await setPrivateKey(key);

      checkPrivateKey(() => showPrivateKeyError());
    },
    onCancel() {
      if (hasOpener) {
        window.close();
      } else {
        window.location.href = rootURL;
      }
    },
    onIngredientAdded(newIngredientIds) {
      renderDeckIngredients(newIngredientIds.map((id) => new UniqCard(id)));
    },
    async onDeckSaved(name, cardData) {
      let fileContent = getDeckContent().split("\n").filter(Boolean);

      const newLine = `${name}|${cardData}`;

      if (isEdit()) {
        const editedLine = `${editedName}|${editedCards}`;

        fileContent = fileContent.map((line) => {
          if (line !== editedLine) {
            return line;
          }

          return newLine;
        });
      } else {
        fileContent.push(newLine);
      }

      goToSection("saving");

      await saveFile(fileContent);

      goToSection("list");
    },
  });

  initSections(({ nextSection, vars }) => {
    switch (nextSection) {
      case "newPrivateKey":
        generateNewPrivateKey().then(async (privateKey) => {
          const publicKey = await getPublicKey();
          try {
            await setFile(publicKey, "");
            showPrivateKey(privateKey);
          } catch (e) {
            setPrivateKey("");
            throw e;
          }
        });
        break;

      case "list": {
        const userDeckContent = getDeckContent();

        const customCharactersData = Boolean(userDeckContent)
          ? userDeckContent.split("\n")
          : [];

        const characters = customCharactersData.map((characterData) => {
          const [name, cards] = characterData.split("|");

          const editLink = document.createElement("a");
          editLink.href = "#create";
          editLink.className = "inlineLink";
          editLink.dataset.name = name;
          editLink.dataset.cards = cards;
          editLink.innerHTML = "Edit";

          const playLink = document.createElement("button");
          playLink.type = "button";
          playLink.className = "inlineLink";
          playLink.dataset.cards = cards;
          playLink.dataset.action = "play";
          playLink.innerHTML = "Play";

          const deleteLink = document.createElement("button");
          deleteLink.type = "button";
          deleteLink.className = "inlineLink";
          deleteLink.dataset.name = name;
          deleteLink.dataset.cards = cards;
          deleteLink.dataset.action = "delete";
          deleteLink.innerHTML = "Delete";

          return {
            id: "totter",
            name: name.replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
            desc: `${deleteLink.outerHTML} ${editLink.outerHTML} ${playLink.outerHTML}`,
          };
        });

        renderCharacterList([
          {
            id: "create",
            name: "Create character",
            desc: "And choose its starter ingredients",
            href: "#create",
          },
          ...characters,
        ]);

        break;
      }

      case "create": {
        editedName = vars.name || "";
        editedCards = vars.cards || "";

        setCardsInputValue(editedCards);
        setCharacterName(editedName);
        break;
      }
    }
  });

  document.body.addEventListener("click", async (e) => {
    const clickedElement = e.target as HTMLElement;
    const { dataset } = clickedElement;

    switch (dataset.action) {
      case "play": {
        if (hasOpener) {
          window.opener.history.pushState(
            null,
            null,
            `index.html?d=${dataset.cards}#rules`
          );
          window.opener.dispatchEvent(new HashChangeEvent("hashchange"));
          window.opener.focus();
          window.close();
        } else {
          window.location.href = `${rootURL}/index.html?d=${dataset.cards}#rules`;
        }
      }

      case "delete": {
        const cardToRemove = clickedElement.closest(".card") as HTMLDivElement;

        document.body.inert = true;
        cardToRemove.style.opacity = "0.5";

        try {
          const lineToDelete = `${dataset.name}|${dataset.cards}`;
          const fileContent = getDeckContent()
            .split("\n")
            .filter((line) => Boolean(line) && line !== lineToDelete);

          await saveFile(fileContent);

          cardToRemove.remove();
        } finally {
          cardToRemove.style.opacity = "1";
          document.body.inert = false;
        }
      }
    }
  });

  if (!privateKey) {
    goToSection("askPrivateKey");
  } else {
    checkPrivateKey(() => goToSection("askPrivateKey"));
  }
})();