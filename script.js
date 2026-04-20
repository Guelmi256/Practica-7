import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

const API_URL = "https://pokeapi.co/api/v2/pokemon?limit=151";

const firebaseConfig = {
apiKey: "AIzaSyCZ2MdkLXJRghKrGpm7JD1UuUr8VNV1IYc",
authDomain: "pruebafirebase-f1a8f.firebaseapp.com",
projectId: "pruebafirebase-f1a8f",
storageBucket: "pruebafirebase-f1a8f.firebasestorage.app",
messagingSenderId: "50146195240",
appId: "1:50146195240:web:65d10a419c0594260a421d"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();
const db = getFirestore(firebaseApp);
const favoritesCollection = collection(db, "favoritos");

const listElement = document.getElementById("pokemon-list");
const featuredCardElement = document.getElementById("featured-card");
const searchInput = document.getElementById("search");
const loadedCountElement = document.getElementById("loaded-count");
const visibleCountElement = document.getElementById("visible-count");
const favoritesCountElement = document.getElementById("favorites-count");
const favoritesListElement = document.getElementById("favorites-list");
const refreshButton = document.getElementById("refresh-btn");
const featuredTemplate = document.getElementById("featured-template");
const authUserElement = document.getElementById("auth-user");
const loginButton = document.getElementById("login-btn");
const logoutButton = document.getElementById("logout-btn");

let pokemonCollection = [];
let filteredCollection = [];
let selectedPokemonId = null;
let favorites = [];
let favoriteIds = new Set();
let favoriteStatusMessage = "";
let currentUser = null;

const typeColors = {
  grass: "#5FAE62",
  poison: "#9D5BBA",
  fire: "#F08A4B",
  water: "#4E9EEA",
  bug: "#8CB230",
  normal: "#9DA0AA",
  electric: "#E9C63E",
  ground: "#C09B52",
  fairy: "#EFA4C6",
  fighting: "#CE4265",
  psychic: "#F36D9B",
  rock: "#B9A15B",
  ghost: "#6F6ECF",
  ice: "#70C9C8",
  dragon: "#0A6DC4",
  dark: "#595761",
  steel: "#5A8EA1",
  flying: "#89AAE3"
};

const typeLabels = {
  grass: "planta",
  poison: "veneno",
  fire: "fuego",
  water: "agua",
  bug: "bicho",
  normal: "normal",
  electric: "eléctrico",
  ground: "tierra",
  fairy: "hada",
  fighting: "lucha",
  psychic: "psíquico",
  rock: "roca",
  ghost: "fantasma",
  ice: "hielo",
  dragon: "dragón",
  dark: "siniestro",
  steel: "acero",
  flying: "volador"
};

const statLabels = {
  hp: "PS",
  attack: "ataque",
  defense: "defensa",
  "special-attack": "ataque especial",
  "special-defense": "defensa especial",
  speed: "velocidad"
};

function formatPokemonName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function translateType(type) {
  return typeLabels[type] || type;
}

function translateStat(statName) {
  return statLabels[statName] || statName.replace("-", " ");
}

async function fetchPokemonSpecies(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("No se pudo cargar la especie del Pokémon.");
  }

  return response.json();
}

function getSpanishPokemonName(species) {
  const spanishName = species.names.find((entry) => entry.language.name === "es");
  return spanishName?.name || null;
}

async function fetchPokemonDetails(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("No se pudo cargar la información del Pokémon.");
  }

  return response.json();
}

async function loadPokemon() {
  showMessage("Cargando Pokémon...");
  refreshButton.disabled = true;
  refreshButton.textContent = "Cargando...";

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("No se pudo conectar con la API.");
    }

    const data = await response.json();
    const details = await Promise.all(data.results.map((pokemon) => fetchPokemonDetails(pokemon.url)));
    const speciesCollection = await Promise.all(
      details.map((pokemon) => fetchPokemonSpecies(pokemon.species.url))
    );

    pokemonCollection = details.map((pokemon, index) => ({
      id: pokemon.id,
      name: pokemon.name,
      displayName: getSpanishPokemonName(speciesCollection[index]) || formatPokemonName(pokemon.name),
      image: pokemon.sprites.other["official-artwork"].front_default || pokemon.sprites.front_default,
      height: pokemon.height / 10,
      weight: pokemon.weight / 10,
      baseExperience: pokemon.base_experience || 0,
      stats: pokemon.stats.map((stat) => ({
        name: translateStat(stat.stat.name),
        value: stat.base_stat
      })),
      types: pokemon.types.map((type) => ({
        key: type.type.name,
        label: translateType(type.type.name)
      }))
    }));

    filteredCollection = [...pokemonCollection];
    selectedPokemonId = pokemonCollection[0]?.id ?? null;

    renderList(filteredCollection);
    renderFeaturedCard(getSelectedPokemon());
    updateCounters();
  } catch (error) {
    showMessage(`${error.message} Intenta recargar.`);
    listElement.innerHTML = "";
    loadedCountElement.textContent = "0";
    visibleCountElement.textContent = "0";
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Recargar";
  }
}

async function loadFavorites() {
  if (!currentUser) {
    favorites = [];
    favoriteIds = new Set();
    renderFavorites();
    renderFeaturedCard(getSelectedPokemon());
    return;
  }

  try {
    const favoritesQuery = query(favoritesCollection, where("uid", "==", currentUser.uid));
    const snapshot = await getDocs(favoritesQuery);
    favorites = snapshot.docs.map((favoriteDoc) => ({
      docId: favoriteDoc.id,
      ...favoriteDoc.data()
    }));
    favoriteIds = new Set(favorites.map((favorite) => favorite.id));
    renderFavorites();
    renderFeaturedCard(getSelectedPokemon());
  } catch (error) {
    favorites = [];
    favoriteIds = new Set();
    favoritesCountElement.textContent = "0";
    favoritesListElement.innerHTML = '<p class="favorites-empty">No se pudieron cargar tus favoritos desde Firebase.</p>';
  }
}

function getSelectedPokemon() {
  return filteredCollection.find((pokemon) => pokemon.id === selectedPokemonId)
    || pokemonCollection.find((pokemon) => pokemon.id === selectedPokemonId)
    || filteredCollection[0]
    || pokemonCollection[0]
    || null;
}

function updateCounters() {
  loadedCountElement.textContent = String(pokemonCollection.length);
  visibleCountElement.textContent = String(filteredCollection.length);
}

function createTypeBadge(type) {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = type.label;
  badge.style.backgroundColor = typeColors[type.key] || "#5d6b86";
  return badge;
}

function formatSavedAt(savedAt) {
  if (!savedAt) {
    return "Sin fecha";
  }

  return new Date(savedAt).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function renderFavorites() {
  favoritesCountElement.textContent = String(favorites.length);

  if (!currentUser) {
    favoritesListElement.innerHTML = '<p class="favorites-empty">Inicia sesión con Google para ver y guardar favoritos.</p>';
    return;
  }

  if (!favorites.length) {
    favoritesListElement.innerHTML = '<p class="favorites-empty">Todavía no hay favoritos guardados.</p>';
    return;
  }

  favoritesListElement.innerHTML = "";

  favorites
    .slice()
    .sort((first, second) => first.id - second.id)
    .forEach((favorite) => {
      const item = document.createElement("div");
      item.className = "favorite-pill";
      item.innerHTML = `
        <strong>#${String(favorite.id).padStart(3, "0")} ${favorite.displayName}</strong>
        <span>${formatSavedAt(favorite.savedAt)}</span>
      `;
      favoritesListElement.appendChild(item);
    });
}

function renderList(collection) {
  listElement.innerHTML = "";

  if (!collection.length) {
    listElement.innerHTML = '<div class="message">No se encontraron Pokémon con ese nombre.</div>';
    return;
  }

  collection.forEach((pokemon) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pokemon-item${pokemon.id === selectedPokemonId ? " is-active" : ""}`;
    button.innerHTML = `
      <img class="pokemon-item__thumb" src="${pokemon.image}" alt="${pokemon.displayName}">
      <div class="pokemon-item__meta">
        <small>#${String(pokemon.id).padStart(3, "0")}</small>
        <h3>${pokemon.displayName}</h3>
      </div>
      <div class="pokemon-item__types"></div>
    `;

    const typesContainer = button.querySelector(".pokemon-item__types");
    pokemon.types.forEach((type) => {
      typesContainer.appendChild(createTypeBadge(type));
    });

    button.addEventListener("click", () => {
      selectedPokemonId = pokemon.id;
      renderList(filteredCollection);
      renderFeaturedCard(pokemon);
    });

    listElement.appendChild(button);
  });
}

function renderFeaturedCard(pokemon) {
  featuredCardElement.innerHTML = "";

  if (!pokemon) {
    showMessage("No hay información para mostrar.");
    return;
  }

  const fragment = featuredTemplate.content.cloneNode(true);
  fragment.querySelector(".pokemon-card__id").textContent = `#${String(pokemon.id).padStart(3, "0")}`;
  fragment.querySelector(".pokemon-card__name").textContent = pokemon.displayName;

  const image = fragment.querySelector(".pokemon-card__image");
  image.src = pokemon.image;
  image.alt = pokemon.displayName;

  fragment.querySelector(".pokemon-card__height").textContent = `${pokemon.height} m`;
  fragment.querySelector(".pokemon-card__weight").textContent = `${pokemon.weight} kg`;
  fragment.querySelector(".pokemon-card__xp").textContent = String(pokemon.baseExperience);

  const typesContainer = fragment.querySelector(".pokemon-card__types");
  pokemon.types.forEach((type) => {
    typesContainer.appendChild(createTypeBadge(type));
  });

  const statsContainer = fragment.querySelector(".pokemon-card__stats");
  pokemon.stats.forEach((stat) => {
    const statRow = document.createElement("div");
    statRow.className = "stat";

    const percentage = Math.min((stat.value / 180) * 100, 100);

    statRow.innerHTML = `
      <span class="stat__name">${stat.name}</span>
      <div class="stat__bar">
        <div class="stat__fill" style="width: ${percentage}%"></div>
      </div>
      <strong>${stat.value}</strong>
    `;

    statsContainer.appendChild(statRow);
  });

  const favoriteButton = fragment.querySelector("#favorite-btn");
  const favoriteStatusElement = fragment.querySelector("#favorite-status");
  const saved = favoriteIds.has(pokemon.id);

  favoriteButton.textContent = currentUser
    ? (saved ? "Quitar de favoritos" : "Guardar en favoritos")
    : "Inicia sesión para guardar";
  favoriteButton.classList.toggle("is-saved", saved);
  favoriteButton.disabled = !currentUser;
  favoriteStatusElement.textContent = favoriteStatusMessage;

  favoriteButton.addEventListener("click", async () => {
    await toggleFavorite(pokemon);
  });

  featuredCardElement.appendChild(fragment);
}

function showMessage(message) {
  featuredCardElement.innerHTML = `<div class="message">${message}</div>`;
}

async function toggleFavorite(pokemon) {
  if (!currentUser) {
    favoriteStatusMessage = "Debes iniciar sesión con Google para guardar favoritos.";
    renderFeaturedCard(getSelectedPokemon());
    return;
  }

  const saved = favoriteIds.has(pokemon.id);

  try {
    if (saved) {
      const favoriteEntry = favorites.find((favorite) => favorite.id === pokemon.id);

      if (favoriteEntry) {
        await deleteDoc(doc(db, "favoritos", favoriteEntry.docId));
      }

      favorites = favorites.filter((favorite) => favorite.id !== pokemon.id);
      favoriteIds.delete(pokemon.id);
      favoriteStatusMessage = `${pokemon.displayName} se eliminó de favoritos.`;
    } else {
      const newFavorite = {
        uid: currentUser.uid,
        id: pokemon.id,
        name: pokemon.name,
        displayName: pokemon.displayName,
        image: pokemon.image,
        savedAt: new Date().toISOString()
      };

      const documentRef = await addDoc(favoritesCollection, newFavorite);
      favorites.push({ docId: documentRef.id, ...newFavorite });
      favoriteIds.add(pokemon.id);
      favoriteStatusMessage = `${pokemon.displayName} se guardó en Firebase.`;
    }

    renderFavorites();
    renderFeaturedCard(getSelectedPokemon());
  } catch (error) {
    favoriteStatusMessage = "Firebase rechazó la operación. Revisa Firestore y sus reglas.";
    renderFeaturedCard(getSelectedPokemon());
  }
}

function updateAuthUI() {
  if (currentUser) {
    authUserElement.textContent = currentUser.displayName || currentUser.email || "Sesión iniciada";
    loginButton.hidden = true;
    logoutButton.hidden = false;
    return;
  }

  authUserElement.textContent = "No has iniciado sesión";
  loginButton.hidden = false;
  logoutButton.hidden = true;
}

function filterPokemon(query) {
  const normalizedQuery = query.trim().toLowerCase();

  filteredCollection = pokemonCollection.filter((pokemon) => (
    pokemon.name.includes(normalizedQuery)
    || pokemon.displayName.toLowerCase().includes(normalizedQuery)
    || String(pokemon.id).includes(normalizedQuery)
  ));

  if (!filteredCollection.some((pokemon) => pokemon.id === selectedPokemonId)) {
    selectedPokemonId = filteredCollection[0]?.id ?? null;
  }

  renderList(filteredCollection);
  renderFeaturedCard(getSelectedPokemon());
  updateCounters();
}

searchInput.addEventListener("input", (event) => {
  filterPokemon(event.target.value);
});

refreshButton.addEventListener("click", () => {
  loadPokemon();
});

loginButton.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    favoriteStatusMessage = "No se pudo iniciar sesión con Google.";
    renderFeaturedCard(getSelectedPokemon());
  }
});

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  favoriteStatusMessage = "";
  updateAuthUI();
  await loadFavorites();
});

loadPokemon();