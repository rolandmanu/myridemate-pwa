const app = document.querySelector("#app");
const storageKey = "myridemate-preferences";
const defaultPreferences = {
  role: "Passager",
  name: "Invité",
  profileNameCustomized: false,
  language: "Français",
  city: "Paris",
  country: "France",
  region: "Île-de-France",
  notifications: true,
  pushEnabled: false,
  notificationSound: "Carillon doux",
  notificationVolume: 65,
  vibrationEnabled: true,
  vibrationIntensity: "moyenne",
  approachTimeMinutes: 10,
  approachDistanceKm: 2,
  dark: false,
  theme: "light",
  gps: true,
  downloaded: false,
  favoriteRoutes: [],
  followedTripId: "",
  driverTripId: "",
  driverSetupComplete: false,
  driverMode: "Bus",
  driverLine: "87 · Gare de Lyon",
  driverOrigin: "Gare de Lyon",
  driverDestination: "Châtelet",
  driverVehicle: "Bus 24 · AB-123-CD",
  driverCompany: "",
  driverPhoto: "",
  savedDriverRoutes: [],
  waitingTripIds: [],
};

let preferences;
try {
  preferences = { ...defaultPreferences, ...JSON.parse(localStorage.getItem(storageKey) || "{}") };
} catch (error) {
  console.error("Impossible de charger les préférences enregistrées.", error);
  preferences = { ...defaultPreferences };
}
if (!preferences.profileNameCustomized) preferences.name = "Invité";
if (!Array.isArray(preferences.savedDriverRoutes)) preferences.savedDriverRoutes = [];
if (!Array.isArray(preferences.waitingTripIds)) preferences.waitingTripIds = [];
if (!["light", "dark", "ocean", "forest"].includes(preferences.theme)) {
  preferences.theme = preferences.dark ? "dark" : "light";
}
preferences.dark = preferences.theme === "dark";

const initialPage = new URLSearchParams(location.search).get("page");
let currentPage = ["home", "trips", "tracking"].includes(initialPage) ? initialPage : "home";
let activeTab = currentPage === "tracking" ? "trips" : currentPage;
let selectedMode = "Bus";
let selectedRoute = "Bus 87";
let selectedScheduleLine = "87 · Gare de Lyon";
let currentQuery = "";
let alertFilter = "Toutes";
let driverMode = preferences.driverMode;
let driverLine = preferences.driverLine;
let driverOrigin = preferences.driverOrigin;
let driverDestination = preferences.driverDestination;
let driverVehicle = preferences.driverVehicle;
let driverCompany = preferences.driverCompany;
let driverPhoto = preferences.driverPhoto;
let driverFormOpen = false;
let toastTimer;
let mapInstances = {};
let trackingMarker = null;
let locationWatchId = null;

const transitModes = ["Bus", "Métro", "Tram", "Train", "Ferry", "Navette", "Funiculaire", "Téléphérique", "Trolleybus", "Covoiturage", "Taxi"];
const modeSpeeds = { Bus: 22, Métro: 32, Tram: 24, Train: 45, Ferry: 18, Navette: 30, Funiculaire: 12, Téléphérique: 16, Trolleybus: 20, Covoiturage: 35, Taxi: 28 };
const availableLanguages = [["🇫🇷", "Français"], ["🇬🇧", "English"], ["🇸🇦", "العربية"], ["🇪🇬", "العربية (مصر)"], ["🇪🇸", "Español"], ["🇩🇪", "Deutsch"], ["🇮🇹", "Italiano"], ["🇵🇹", "Português"], ["🇳🇱", "Nederlands"], ["🇹🇷", "Türkçe"], ["🇷🇺", "Русский"], ["ⵣ", "Tamaziɣt"], ["🇨🇳", "中文"]];

const routes = [
  { line: "Bus 87", from: "Gare de Lyon", to: "Châtelet", time: "3 min", duration: "18 min", kind: "bus", color: "blue" },
  { line: "Métro 6", from: "Bir-Hakeim", to: "Montparnasse", time: "8 min", duration: "21 min", kind: "metro", color: "red" },
  { line: "Tram T3a", from: "Porte de Versailles", to: "Pont du Garigliano", time: "5 min", duration: "14 min", kind: "tram", color: "green" },
  { line: "RER A", from: "Gare de Lyon", to: "Nation", time: "4 min", duration: "11 min", kind: "train", color: "blue" },
  { line: "Batobus Seine", from: "Hôtel de Ville", to: "Tour Eiffel", time: "12 min", duration: "35 min", kind: "ferry", color: "blue" },
  { line: "Navette aéroport", from: "Opéra", to: "Aéroport CDG", time: "8 min", duration: "45 min", kind: "bus", color: "orange" },
  { line: "Funiculaire F1", from: "Saint-Jean", to: "Fourvière", time: "5 min", duration: "8 min", kind: "train", color: "red" },
  { line: "Téléphérique urbain", from: "Station basse", to: "Station haute", time: "7 min", duration: "12 min", kind: "cablecar", color: "green" },
  { line: "Trolleybus C13", from: "Hôtel de Ville", to: "Montessuy", time: "6 min", duration: "18 min", kind: "bus", color: "green" },
  { line: "Covoiturage", from: "Bastille", to: "La Défense", time: "7 min", duration: "24 min", kind: "car", color: "blue" },
  { line: "Taxi", from: "Votre position", to: "Gare de Lyon", time: "4 min", duration: "12 min", kind: "car", color: "orange" },
];
const citiesByCountry = {
  France: ["Paris", "Lyon", "Marseille", "Bordeaux", "Lille"],
  Belgique: ["Bruxelles", "Anvers", "Liège"],
  Suisse: ["Genève", "Lausanne", "Zurich"],
  Canada: ["Montréal", "Québec", "Toronto"],
};
const regionsByCity = {
  Paris: "Île-de-France", Lyon: "Auvergne-Rhône-Alpes", Marseille: "Provence-Alpes-Côte d'Azur",
  Bordeaux: "Nouvelle-Aquitaine", Lille: "Hauts-de-France", Bruxelles: "Bruxelles-Capitale",
  Anvers: "Flandre", Liège: "Wallonie", Genève: "Canton de Genève", Lausanne: "Vaud",
  Zurich: "Zurich", Montréal: "Québec", Québec: "Québec", Toronto: "Ontario",
};
if (!citiesByCountry[preferences.country]) preferences.country = "France";
if (!citiesByCountry[preferences.country].includes(preferences.city)) preferences.city = citiesByCountry[preferences.country][0];
preferences.region = regionsByCity[preferences.city] || preferences.region;
const cityCoordinates = {
  Paris: [48.8566, 2.3522], Lyon: [45.764, 4.8357], Marseille: [43.2965, 5.3698],
  Bordeaux: [44.8378, -0.5792], Lille: [50.6292, 3.0573], Bruxelles: [50.8503, 4.3517],
  Anvers: [51.2194, 4.4025], Liège: [50.6326, 5.5797], Genève: [46.2044, 6.1432],
  Lausanne: [46.5197, 6.6323], Zurich: [47.3769, 8.5417], Montréal: [45.5019, -73.5674],
  Québec: [46.8139, -71.208], Toronto: [43.6532, -79.3832],
};
const scheduleOptions = {
  Bus: ["87 · Gare de Lyon", "24 · Panthéon", "72 · Parc de Saint-Cloud"],
  Métro: ["6 · Charles de Gaulle–Étoile", "1 · La Défense", "4 · Bagneux"],
  Tram: ["T3a · Pont du Garigliano", "T2 · Porte de Versailles"],
  Train: ["RER A · Marne-la-Vallée", "RER B · Aéroport CDG"],
  Ferry: ["Batobus · Seine", "Navette fluviale · Vieux-Port"],
  Navette: ["Navette aéroport · CDG", "Navette centre-ville"],
  Funiculaire: ["F1 · Saint-Jean–Fourvière", "F2 · Saint-Paul"],
  Téléphérique: ["Téléphérique urbain · Ligne A", "Téléphérique · Station centrale"],
  Trolleybus: ["C13 · Montessuy", "C3 · Gare Saint-Paul"],
  Covoiturage: ["Covoiturage · Paris centre", "Covoiturage · La Défense"],
  Taxi: ["Taxi · disponibilité locale", "Taxi · réservation"],
};
const scheduleStopsByMode = {
  Bus: ["Gare de Lyon", "Châtelet", "République", "Gare de l'Est"],
  Métro: ["Trocadéro", "Charles de Gaulle–Étoile", "Franklin D. Roosevelt", "Concorde"],
  Tram: ["Porte de Versailles", "Balard", "Pont du Garigliano", "Porte d'Issy"],
  Train: ["Gare de Lyon", "Châtelet–Les Halles", "Auber", "Nation"],
  Ferry: ["Tour Eiffel", "Musée d'Orsay", "Louvre", "Hôtel de Ville"],
  Navette: ["Opéra", "Porte de la Chapelle", "Aéroport CDG"],
  Funiculaire: ["Station basse", "Station intermédiaire", "Station haute"],
  Téléphérique: ["Station basse", "Station intermédiaire", "Station haute"],
  Trolleybus: ["Hôtel de Ville", "Croix-Rousse", "Montessuy"],
  Covoiturage: ["Bastille", "Louvre", "Porte Maillot", "La Défense"],
  Taxi: ["Votre position", "Prise en charge", "Dépose prévue"],
};
const featuredByMode = {
  Bus: "Bus 87", Métro: "Métro 6", Tram: "Tram T3a", Train: "RER A",
  Ferry: "Batobus Seine", Navette: "Navette aéroport", Funiculaire: "Funiculaire F1",
  Téléphérique: "Téléphérique urbain", Trolleybus: "Trolleybus C13", Covoiturage: "Covoiturage", Taxi: "Taxi",
};
const parisStops = [
  { name: "Gare de Lyon", position: [48.8443, 2.373] },
  { name: "Châtelet", position: [48.8584, 2.347] },
  { name: "Arts et Métiers", position: [48.8655, 2.3562] },
  { name: "République", position: [48.8674, 2.3631] },
  { name: "Gare de l'Est", position: [48.8762, 2.3591] },
];
const routePlans = {
  "Bus 87": { color: "#1268e5", stops: parisStops },
  "Métro 6": { color: "#eb5160", stops: [
    { name: "Bir-Hakeim", position: [48.8539, 2.2896] },
    { name: "La Motte-Picquet", position: [48.849, 2.298] },
    { name: "Montparnasse", position: [48.843, 2.321] },
  ] },
  "Tram T3a": { color: "#16a875", stops: [
    { name: "Porte de Versailles", position: [48.832, 2.288] },
    { name: "Balard", position: [48.836, 2.278] },
    { name: "Pont du Garigliano", position: [48.84, 2.267] },
  ] },
  "RER A": { color: "#1268e5", stops: [
    { name: "Gare de Lyon", position: [48.8443, 2.373] },
    { name: "Châtelet–Les Halles", position: [48.8584, 2.347] },
    { name: "Auber", position: [48.872, 2.331] },
    { name: "Nation", position: [48.848, 2.395] },
  ] },
  "Batobus Seine": { color: "#1879bd", stops: [
    { name: "Tour Eiffel", position: [48.8584, 2.2945] },
    { name: "Musée d'Orsay", position: [48.86, 2.326] },
    { name: "Louvre", position: [48.86, 2.3376] },
    { name: "Hôtel de Ville", position: [48.8566, 2.3522] },
  ] },
  "Navette aéroport": { color: "#ef9f28", stops: [
    { name: "Opéra", position: [48.8708, 2.3322] },
    { name: "Porte de la Chapelle", position: [48.897, 2.359] },
    { name: "Aéroport CDG", position: [49.0097, 2.5479] },
  ] },
  "Funiculaire F1": { color: "#e14958", stops: [
    { name: "Saint-Jean", position: [45.7604, 4.8277] },
    { name: "Fourvière", position: [45.7624, 4.8226] },
  ] },
  "Téléphérique urbain": { color: "#16a875", stops: [
    { name: "Station basse", position: [48.8505, 2.355] },
    { name: "Station intermédiaire", position: [48.858, 2.36] },
    { name: "Station haute", position: [48.865, 2.365] },
  ] },
  "Trolleybus C13": { color: "#16a875", stops: [
    { name: "Hôtel de Ville", position: [45.767, 4.834] },
    { name: "Croix-Rousse", position: [45.777, 4.827] },
    { name: "Montessuy", position: [45.795, 4.844] },
  ] },
  Covoiturage: { color: "#1268e5", stops: [
    { name: "Bastille", position: [48.853, 2.369] },
    { name: "Louvre", position: [48.8606, 2.3376] },
    { name: "La Défense", position: [48.8918, 2.2362] },
  ] },
  Taxi: { color: "#ef9f28", stops: [
    { name: "Votre position", position: [48.8566, 2.3522] },
    { name: "Gare de Lyon", position: [48.8443, 2.373] },
  ] },
};
const notificationSounds = [
  { name: "Carillon doux", notes: [659, 784, 988] },
  { name: "Cloche claire", notes: [880, 1175] },
  { name: "Double cloche", notes: [740, 740, 988] },
  { name: "Goutte d'eau", notes: [1047, 784, 1175] },
  { name: "Onde légère", notes: [523, 659, 784, 659] },
  { name: "Alerte bleue", notes: [880, 660, 880] },
  { name: "Métro", notes: [440, 554, 659] },
  { name: "Bus urbain", notes: [587, 784, 587] },
  { name: "Tramway", notes: [698, 880, 1047] },
  { name: "Train express", notes: [523, 784, 1047, 784] },
  { name: "Réveil doux", notes: [392, 523, 659, 784] },
  { name: "Radar", notes: [880, 440, 880, 440] },
  { name: "Pixel", notes: [988, 784, 1175, 988] },
  { name: "Horizon", notes: [392, 494, 587, 784] },
  { name: "Étoiles", notes: [1318, 1047, 1568] },
  { name: "Sillage", notes: [587, 698, 880, 1047] },
  { name: "Pulse", notes: [660, 660, 880, 880] },
  { name: "Écho", notes: [784, 587, 784] },
  { name: "Accord majeur", notes: [523, 659, 784] },
  { name: "Signature", notes: [784, 988, 1175, 1568] },
];
const photoScenes = {
  bus: {
    src: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=1200&q=80",
    alt: "Autobus urbain en circulation",
  },
  car: {
    src: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80",
    alt: "Voiture circulant en ville",
  },
  city: {
    src: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80",
    alt: "Panorama urbain au coucher du soleil",
  },
  train: {
    src: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1200&q=80",
    alt: "Voie ferrée traversant un paysage",
  },
  ferry: {
    src: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
    alt: "Bateau naviguant sur l'eau",
  },
  metro: {
    src: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80",
    alt: "Transport collectif en ville",
  },
  skyline: {
    src: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=1200&q=80",
    alt: "Vue sur les immeubles d'une grande ville",
  },
};
const liveTripsKey = "myridemate-live-trips";
const demoTrip = {
  id: "demo-paris-87",
  code: "MM-87A2",
  city: "Paris",
  driver: "Conducteur invité",
  mode: "Bus",
  line: "Bus 87",
  from: "Gare de Lyon",
  to: "Châtelet",
  routeStops: ["Gare de Lyon", "Quai de la Rapée", "Pont d'Austerlitz", "Sully–Morland", "Bastille", "Saint-Paul", "Hôtel de Ville", "Châtelet"],
  totalDistanceKm: 2.4,
  totalMinutes: 15,
  progressPercent: 20,
  speedKmh: 18,
  elapsedMinutes: 3,
  remainingMinutes: 12,
  remainingKm: 1.9,
  waitingPassengers: 0,
  latitude: 48.8566,
  longitude: 2.3522,
  status: "active",
  demo: true,
  updatedAt: Date.now(),
  approachAlertSent: false,
};
let liveTrips;
try {
  const savedTrips = JSON.parse(localStorage.getItem(liveTripsKey) || "null");
  liveTrips = Array.isArray(savedTrips) ? savedTrips : [demoTrip];
  if (!savedTrips) localStorage.setItem(liveTripsKey, JSON.stringify(liveTrips));
  const savedDemoTrip = liveTrips.find((trip) => trip.id === demoTrip.id && trip.demo);
  if (savedDemoTrip && savedDemoTrip.routeStops?.length !== demoTrip.routeStops.length) {
    savedDemoTrip.routeStops = [...demoTrip.routeStops];
    localStorage.setItem(liveTripsKey, JSON.stringify(liveTrips));
  }
} catch (error) {
  console.error("Impossible de charger les trajets locaux.", error);
  liveTrips = [demoTrip];
}

const stops = ["Châtelet", "Rambuteau", "Arts et Métiers", "République", "Gare de l'Est"];
const icon = (name, size = 20) => {
  const paths = {
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    bus: '<rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 10h16M8 19v2m8-2v2M8 6h.01M16 6h.01"/>',
    metro: '<path d="M5 20V4m14 16V4M5 6l7 6 7-6M5 17l7-6 7 6"/>',
    tram: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M8 21h8m-4-3v3M5 9h14M9 6h.01M15 6h.01M8 13h8"/>',
    train: '<rect x="5" y="3" width="14" height="17" rx="3"/><path d="m8 20-2 2m10-2 2 2M8 7h8M8 11h.01M16 11h.01M9 16h6"/>',
    ferry: '<path d="M3 16h18l-3 5H7l-4-5Zm2 0 2-8h10l3 8M12 8V3m0 0 4 3"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    cablecar: '<path d="M3 4h18M8 4l4 7m4-7-4 7"/><rect x="7" y="11" width="10" height="9" rx="2"/><path d="M10 14h4m-5 6-2 2m12-2-2 2"/>',
    route: '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M9 18h3a3 3 0 0 0 3-3V9"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.7-1.4-2.4 1.4-1.1A8 8 0 0 1 7 13.2l-1.8-.3v-2.8l1.8-.3a8 8 0 0 1 .9-1.6L6.5 6.5l2.4-1.4 1.1 1.4a8 8 0 0 1 1.8-.4l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1 .4 1.8l1.8.3v2.8l-1.8.3a8 8 0 0 1-.9 1.6Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    arrow: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3"/>',
    moon: '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    expand: '<path d="M15 3h6v6m-7 1 7-7M9 21H3v-6m7-1-7 7"/>',
    play: '<path d="m8 5 12 7-12 7V5Z"/>',
    vibration: '<path d="M2 9v6m4-9v12m12-12v12m4-9v6M9 7h6v10H9z"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    location: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
    car: '<path d="m5 11 1.5-5h11l1.5 5M3 11h18v8H3zM6 19v2m12-2v2M6 15h.01M18 15h.01"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 2.6a2 2 0 0 1-.6 1.9L7.7 9.5a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 1.9-.6l2.6.5a2 2 0 0 1 1.7 2Z"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.route}</svg>`;
};

function modeIcon(mode) {
  return ({ Bus: "bus", Métro: "metro", Tram: "tram", Train: "train", Ferry: "ferry", Navette: "bus", Funiculaire: "train", Téléphérique: "cablecar", Trolleybus: "bus", Covoiturage: "car", Taxi: "car" })[mode] || "route";
}

function photoSceneForMode(mode) {
  return ({ Bus: "bus", Métro: "metro", Tram: "metro", Train: "train", Ferry: "ferry", Navette: "bus", Funiculaire: "train", Téléphérique: "train", Trolleybus: "bus", Covoiturage: "car", Taxi: "car" })[mode] || "bus";
}

function activeTrips() {
  return liveTrips.filter((trip) => trip.status === "active");
}

function currentDriverTrip() {
  return liveTrips.find((trip) => trip.id === preferences.driverTripId && trip.status === "active") || null;
}

function followedTrip() {
  return liveTrips.find((trip) => trip.id === preferences.followedTripId && trip.status === "active") || null;
}

function saveLiveTrips() {
  localStorage.setItem(liveTripsKey, JSON.stringify(liveTrips));
  tripChannel?.postMessage({ type: "trips-updated", trips: liveTrips });
}

function receiveLiveTrips(trips) {
  if (!Array.isArray(trips)) return;
  liveTrips = trips;
  const trip = followedTrip();
  if (trip) {
    trackingMarker?.setLatLng([trip.latitude, trip.longitude]);
    updateTrackingValues(trip);
    checkApproachAlert(trip);
  } else if (currentPage === "tracking") {
    render();
  } else if (currentPage === "trips") {
    render();
  }
}

const tripChannel = "BroadcastChannel" in window ? new BroadcastChannel("myridemate-live-trips") : null;
if (tripChannel) {
  tripChannel.addEventListener("message", (event) => {
    if (event.data?.type === "trips-updated") receiveLiveTrips(event.data.trips);
  });
}
window.addEventListener("storage", (event) => {
  if (event.key !== liveTripsKey || !event.newValue) return;
  try {
    receiveLiveTrips(JSON.parse(event.newValue));
  } catch (error) {
    console.error("Impossible de synchroniser les trajets d'un autre onglet.", error);
  }
});

function savePreferences() {
  localStorage.setItem(storageKey, JSON.stringify(preferences));
  preferences.dark = preferences.theme === "dark";
  const systemTheme = preferences.followSystem && window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = systemTheme ? "dark" : preferences.theme;
}

function translateText(text) {
  const locale = window.MyridemateI18n?.codes[preferences.language] || "fr";
  if (locale !== "fr") {
    const dynamicPatterns = [
      [/^Position détectée automatiquement · (.+)$/, (_, city) => `${translateText("Position détectée automatiquement")} · ${city}`],
      [/^Direction (.+)$/, (_, destination) => `${translateText("Direction")} ${destination}`],
      [/^Autour de (.+)$/, (_, city) => `${translateText("Autour de")} ${city}`],
      [/^(\d+) actif\(s\)$/, (_, count) => `${count} ${translateText("actif(s)")}`],
      [/^(\d+) passager\(s\) attendent sur cette ligne$/, (_, count) => `${count} ${translateText("passager(s) attendent sur cette ligne")}`],
      [/^Localisation définie sur (.+)\.$/, (_, city) => `${translateText("Localisation définie sur")} ${city}.`],
      [/^Position simulée : (.+)\.$/, (_, city) => `${translateText("Position simulée")} : ${city}.`],
      [/^Carte de (.+) disponible hors ligne\.$/, (_, city) => `${translateText("Carte de")} ${city} ${translateText("disponible hors ligne.")}`],
      [/^Aujourd'hui · (.+)$/, (_, time) => `${translateText("Aujourd'hui")} · ${time}`],
      [/^Hier · (.+)$/, (_, time) => `${translateText("Hier")} · ${time}`],
      [/^Langue: (.+)$/, (_, language) => `${translateText("Langue")}: ${language}`],
      [/^Départs et arrêts · (.+)$/, (_, mode) => `${translateText("Départs et arrêts")} · ${translateText(mode)}`],
      [/^Alerte réglée à (\d+) min ou (.+)$/, (_, minutes, distance) => `${translateText("Alerte réglée à")} ${minutes} min ${translateText("ou")} ${distance}`],
      [/^Conducteur · (.+)$/, (_, name) => `${translateText("Conducteur")} · ${translateText(name)}`],
      [/^Conducteur invité · (.+)$/, (_, code) => `${translateText("Conducteur invité")} · ${code}`],
      [/^J'attends ici · (\d+)$/, (_, count) => `${translateText("J'attends ici")} · ${count}`],
      [/^Je n'attends plus ici · (\d+)$/, (_, count) => `${translateText("Je n'attends plus ici")} · ${count}`],
      [/^(.+) · sans inscription$/, (_, role) => `${translateText(role)} · ${translateText("sans inscription")}`],
      [/^(.+) prêt$/, (_, city) => `${city} ${translateText("prêt")}`],
      [/^(.+) · permission de votre appareil$/, (_, state) => `${translateText(state)} · ${translateText("permission de votre appareil")}`],
      [/^Arrêt (.+)$/, (_, stop) => `${translateText("Arrêt")} ${stop}`],
      [/^Destination · (.+)$/, (_, city) => `${translateText("Destination")} · ${city}`],
      [/^(.+) · horaires simulés pour (.+)\.$/, (_, line, city) => `${line} · ${translateText("horaires simulés pour")} ${city}.`],
      [/^Ligne (.+) sélectionnée\.$/, (_, line) => `${translateText("Ligne")} ${line} ${translateText("sélectionnée.")}`],
    ];
    for (const [pattern, format] of dynamicPatterns) {
      if (pattern.test(text)) return text.replace(pattern, format);
    }
  }
  return window.MyridemateI18n?.translate(text, preferences.language) || text;
}

function applyTranslations() {
  const locale = window.MyridemateI18n?.codes[preferences.language] || "fr";
  document.documentElement.lang = locale;
  document.documentElement.dir = locale.startsWith("ar") ? "rtl" : "ltr";
  const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue;
    const leading = value.match(/^\s*/)?.[0] || "";
    const trailing = value.match(/\s*$/)?.[0] || "";
    const text = value.slice(leading.length, value.length - trailing.length);
    if (text) node.nodeValue = `${leading}${translateText(text)}${trailing}`;
  }
  app.querySelectorAll("[aria-label], [placeholder], [title], img[alt]").forEach((element) => {
    for (const attribute of ["aria-label", "placeholder", "title", "alt"]) {
      if (element.hasAttribute(attribute)) element.setAttribute(attribute, translateText(element.getAttribute(attribute)));
    }
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function photoBanner(scene, title, subtitle, photoSource = "") {
  const photo = photoScenes[scene] || photoScenes.city;
  const image = photoSource || photo.src;
  const alt = photoSource ? "Photo du transport" : photo.alt;
  return `<section class="page-photo-banner"><img src="${escapeHTML(image)}" alt="${escapeHTML(translateText(alt))}" loading="eager"><div class="page-photo-shade"></div><div class="page-photo-copy"><strong>${escapeHTML(title)}</strong><small>${escapeHTML(subtitle)}</small></div><a class="page-photo-credit" href="https://unsplash.com/" target="_blank" rel="noreferrer">Photo · Unsplash</a></section>`;
}

function showToast(message) {
  const region = document.querySelector("#toast-region");
  region.innerHTML = `<div class="toast">${icon("shield", 17)}<span>${escapeHTML(translateText(message))}</span></div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { region.innerHTML = ""; }, 3000);
}

function playNotificationSound(soundName = preferences.notificationSound) {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    showToast("La lecture audio n'est pas prise en charge par ce navigateur.");
    return;
  }
  const sound = notificationSounds.find((item) => item.name === soundName);
  if (!sound || preferences.notificationVolume <= 0) return;
  const context = new AudioContextConstructor();
  const volume = preferences.notificationVolume / 100;
  sound.notes.forEach((frequency, index) => {
    const start = context.currentTime + index * 0.18;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.12), start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.17);
  });
  context.resume().catch((error) => {
    console.error("La lecture du son de notification a échoué.", error);
    showToast("Impossible de lire le son. Vérifiez les réglages audio de votre appareil.");
  });
  setTimeout(() => context.close().catch((error) => console.error("Impossible de fermer le contexte audio.", error)), sound.notes.length * 180 + 500);
}

function vibrateForAlert() {
  if (!preferences.vibrationEnabled) return;
  if (!("vibrate" in navigator)) {
    showToast("Le vibreur n'est pas pris en charge par cet appareil.");
    return;
  }
  const patterns = { faible: [100], moyenne: [180, 90, 180], forte: [300, 100, 300, 100, 300] };
  navigator.vibrate(patterns[preferences.vibrationIntensity] || patterns.moyenne);
}

async function showBrowserNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, { body, icon: "./icon.svg", tag: "myridemate-approach", data: { page: "trips" } });
  } else {
    new Notification(title, { body, icon: "./icon.svg" });
  }
}

function checkApproachAlert(trip) {
  if (!trip || trip.status !== "active" || trip.approachAlertSent || !preferences.notifications) return;
  const reachedByTime = trip.remainingMinutes <= Number(preferences.approachTimeMinutes);
  const reachedByDistance = trip.remainingKm <= Number(preferences.approachDistanceKm);
  if (!reachedByTime && !reachedByDistance) return;
  trip.approachAlertSent = true;
  saveLiveTrips();
  const reason = reachedByTime && reachedByDistance ? "temps et distance" : reachedByTime ? "temps" : "distance";
  const message = `${trip.line} approche de ${trip.to} (${reason}).`;
  showToast(message);
  playNotificationSound();
  vibrateForAlert();
  if (preferences.pushEnabled) {
    showBrowserNotification("Votre trajet approche", message).catch((error) => {
      console.error("La notification locale a échoué.", error);
      showToast("Impossible d'afficher la notification sur cet appareil.");
    });
  }
}

function routeStopsForTrip(mode, from, to) {
  const stopsForMode = scheduleStopsByMode[mode] || [];
  const fromIndex = stopsForMode.indexOf(from);
  const toIndex = stopsForMode.indexOf(to);
  return fromIndex >= 0 && toIndex > fromIndex ? stopsForMode.slice(fromIndex, toIndex + 1) : [from, to];
}

function routeSegmentDistances(mode, routeStops) {
  const route = routePlans[featuredByMode[mode]];
  const coordinates = routeStops.map((name) => route?.stops.find((stop) => stop.name === name)?.position);
  if (coordinates.length > 1 && coordinates.every(Boolean)) {
    return coordinates.slice(1).map((position, index) => {
      const [lat1, lon1] = coordinates[index];
      const [lat2, lon2] = position;
      const radians = (degrees) => (degrees * Math.PI) / 180;
      const deltaLat = radians(lat2 - lat1);
      const deltaLon = radians(lon2 - lon1);
      const value = Math.sin(deltaLat / 2) ** 2
        + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    });
  }
  return Array(Math.max(1, routeStops.length - 1)).fill(2.4);
}

function tripSegments(trip) {
  const routeStops = Array.isArray(trip.routeStops) && trip.routeStops.length > 1
    ? trip.routeStops
    : routeStopsForTrip(trip.mode, trip.from, trip.to);
  const measuredDistances = routeSegmentDistances(trip.mode, routeStops);
  const measuredTotal = measuredDistances.reduce((total, distance) => total + distance, 0);
  const totalDistanceKm = Number(trip.totalDistanceKm) || measuredTotal;
  const totalMinutes = Number(trip.totalMinutes) || Number(trip.remainingMinutes) || 1;
  return routeStops.slice(1).map((to, index) => {
    const distanceKm = totalDistanceKm * measuredDistances[index] / measuredTotal;
    return {
      from: routeStops[index],
      to,
      distanceKm,
      minutes: Math.max(1, Math.round(totalMinutes * distanceKm / totalDistanceKm)),
    };
  });
}

function isWaitingForTrip(trip) {
  return preferences.waitingTripIds.includes(trip.id);
}

function ensureTripProgress(trip) {
  if (!Array.isArray(trip.routeStops) || trip.routeStops.length < 2) {
    trip.routeStops = routeStopsForTrip(trip.mode, trip.from, trip.to);
  }
  if (!Number.isFinite(trip.elapsedMinutes) || !Number.isFinite(trip.totalMinutes)) {
    const remainingMinutes = Number(trip.remainingMinutes) || 1;
    trip.elapsedMinutes = trip.demo ? 0 : Math.max(0, 45 - remainingMinutes);
    trip.totalMinutes = trip.demo ? remainingMinutes : Math.max(1, trip.elapsedMinutes + remainingMinutes);
  }
  if (!Number.isFinite(trip.totalDistanceKm)) {
    const remaining = Number(trip.remainingKm) || 0;
    trip.totalDistanceKm = trip.demo
      ? remaining
      : Number((remaining + (trip.elapsedMinutes / 3) * 0.7).toFixed(1)) || 2.4;
  }
  if (!Number.isFinite(trip.progressPercent)) {
    trip.progressPercent = Math.min(100, Math.max(0, trip.elapsedMinutes / trip.totalMinutes * 100));
  }
  if (!Number.isFinite(trip.speedKmh)) trip.speedKmh = modeSpeeds[trip.mode] || 22;
  if (!Number.isFinite(trip.waitingPassengers)) trip.waitingPassengers = 0;
  if (!Number.isFinite(trip.startedAt)) trip.startedAt = Date.now() - trip.elapsedMinutes * 60000;
}

function currentTripStopIndex(trip, stopCount) {
  const progress = Math.min(100, Math.max(0, Number(trip.progressPercent) || 0));
  if (progress >= 100 || stopCount <= 1) return stopCount - 1;
  const elapsedMinutes = Math.max(0, Number(trip.elapsedMinutes) || 0);
  if (elapsedMinutes === 0) return 0;
  let cumulativeMinutes = 0;
  const segments = tripSegments(trip);
  for (let index = 0; index < segments.length; index += 1) {
    cumulativeMinutes += segments[index].minutes;
    if (elapsedMinutes < cumulativeMinutes) return index + 1;
  }
  return stopCount - 1;
}

function tripStopsMarkup(trip) {
  const segments = tripSegments(trip);
  const stops = [trip.from, ...segments.map((segment) => segment.to)];
  let elapsedOnRoute = 0;
  const arrivalTimes = stops.map((_, index) => {
    if (index > 0) elapsedOnRoute += segments[index - 1].minutes;
    const locale = window.MyridemateI18n?.codes[preferences.language] || "fr-FR";
    return new Date(trip.startedAt + elapsedOnRoute * 60000).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  });
  const currentIndex = currentTripStopIndex(trip, stops.length);
  const progress = Math.min(100, Math.max(0, Number(trip.progressPercent) || 0));
  return `<section class="trip-stops-section" aria-label="Arrêts du trajet">
    <div class="trip-stops-heading"><h3>Arrêts</h3><span>${stops.length} arrêts</span></div>
    <div class="trip-stop-timeline" style="--stop-count:${stops.length};--trip-progress:${progress}%">
      <div class="trip-stop-rail" aria-hidden="true"><i class="trip-stop-rail-base"></i><i class="trip-stop-rail-progress"></i><span class="trip-stop-bus">${icon("bus", 15)}</span></div>
      <ol class="trip-stop-list">${stops.map((stop, index) => {
        const state = index < currentIndex ? "passed" : index === currentIndex ? "current" : "upcoming";
        const timeLabel = state === "passed" ? "Passé à" : "Arrivée estimée";
        return `<li class="trip-stop-item ${state}" ${state === "current" ? 'aria-current="step"' : ""}><span class="trip-stop-dot" aria-hidden="true"></span><span class="trip-stop-copy"><strong>${escapeHTML(stop)}</strong><small><span class="trip-stop-time-label">${timeLabel}</span><time>${arrivalTimes[index]}</time></small></span></li>`;
      }).join("")}</ol>
    </div>
  </section>`;
}

function tripProgressMarkup(trip, showWaitButton = false) {
  ensureTripProgress(trip);
  const segments = tripSegments(trip);
  const progress = Math.min(100, Math.max(0, Number(trip.progressPercent) || 0));
  const segmentSize = 100 / segments.length;
  const activeSegmentIndex = Math.min(segments.length - 1, Math.floor(progress / segmentSize));
  return `<section class="trip-progress" aria-label="Progression simulée du trajet">
    <div class="trip-progress-heading"><strong>Avancement du trajet</strong><span><b id="trip-progress-percent">${Math.round(progress)}</b>% · SIMULATION</span></div>
    <div class="trip-progress-metrics">
      <div><small>Vitesse</small><strong><span id="trip-speed">${Math.round(trip.speedKmh || 0)}</span> km/h</strong></div>
      <div><small>Temps écoulé</small><strong><span id="trip-elapsed">${trip.elapsedMinutes || 0}</span> min</strong></div>
      <div><small>Temps restant</small><strong><span id="tracking-eta">${trip.remainingMinutes}</span> min</strong></div>
      <div><small>Distance restante</small><strong><span id="tracking-distance">${Number(trip.remainingKm).toFixed(1)}</span> km</strong></div>
    </div>
    ${tripStopsMarkup(trip)}
    <div class="station-progress-list">${segments.map((segment, index) => {
      const segmentProgress = Math.min(100, Math.max(0, (progress - index * segmentSize) / segmentSize * 100));
      const state = segmentProgress >= 100 ? "complete" : index === activeSegmentIndex ? "current" : "";
      const waitButton = showWaitButton && index === activeSegmentIndex
        ? `<div class="tracking-wait-panel"><span><strong data-waiting-count data-trip-id="${escapeHTML(trip.id)}">${trip.waitingPassengers || 0}</strong> passager(s) attendent</span><button class="button ${isWaitingForTrip(trip) ? "button-soft" : "button-primary"}" data-action="wait-for-trip" data-wait-button data-trip-id="${escapeHTML(trip.id)}" aria-pressed="${isWaitingForTrip(trip)}">${isWaitingForTrip(trip) ? "Je n'attends plus ici" : "J'attends ici"} · ${trip.waitingPassengers || 0}</button></div>`
        : "";
      return `<div class="station-progress-segment ${state}" data-segment-index="${index}"><div class="station-progress-label"><strong>${escapeHTML(segment.from)} → ${escapeHTML(segment.to)}</strong><small>${formatDistance(segment.distanceKm)} · ${segment.minutes} min · <span data-segment-speed>${Math.round(trip.speedKmh || 0)} km/h</span></small></div>${waitButton}<div class="station-progress-bar"><i style="width:${segmentProgress}%"></i></div></div>`;
    }).join("")}</div>
  </section>`;
}

function updateTrackingValues(trip) {
  ensureTripProgress(trip);
  const eta = document.querySelector("#tracking-eta");
  const distance = document.querySelector("#tracking-distance");
  const driverEta = document.querySelector("#driver-eta");
  const driverDistance = document.querySelector("#driver-distance");
  if (eta) eta.textContent = `${trip.remainingMinutes}`;
  if (distance) distance.textContent = `${trip.remainingKm.toFixed(1)}`;
  if (driverEta) driverEta.textContent = `${trip.remainingMinutes} min`;
  if (driverDistance) driverDistance.textContent = `${trip.remainingKm.toFixed(1)} km`;
  const speed = document.querySelector("#trip-speed");
  const elapsed = document.querySelector("#trip-elapsed");
  const percent = document.querySelector("#trip-progress-percent");
  if (speed) speed.textContent = `${Math.round(trip.speedKmh || 0)}`;
  if (elapsed) elapsed.textContent = `${trip.elapsedMinutes || 0}`;
  const progress = Math.min(100, Math.max(0, Number(trip.progressPercent) || 0));
  if (percent) percent.textContent = `${Math.round(progress)}`;
  document.querySelectorAll("[data-segment-speed]").forEach((value) => {
    value.textContent = `${Math.round(trip.speedKmh || 0)} km/h`;
  });
  const timeline = document.querySelector(".trip-stop-timeline");
  if (timeline) timeline.style.setProperty("--trip-progress", `${progress}%`);
  const currentStopIndex = currentTripStopIndex(trip, trip.routeStops.length);
  document.querySelectorAll(".trip-stop-item").forEach((stop, index) => {
    const state = index < currentStopIndex ? "passed" : index === currentStopIndex ? "current" : "upcoming";
    stop.classList.remove("passed", "current", "upcoming");
    stop.classList.add(state);
    const timeLabel = stop.querySelector(".trip-stop-time-label");
    if (timeLabel) timeLabel.textContent = translateText(state === "passed" ? "Passé à" : "Arrivée estimée");
    if (state === "current") stop.setAttribute("aria-current", "step");
    else stop.removeAttribute("aria-current");
  });
  const segments = tripSegments(trip);
  const segmentSize = 100 / segments.length;
  const activeSegmentIndex = Math.min(segments.length - 1, Math.floor(progress / segmentSize));
  document.querySelectorAll(".station-progress-segment").forEach((row) => {
    const index = Number(row.dataset.segmentIndex);
    const segmentProgress = Math.min(100, Math.max(0, (progress - index * segmentSize) / segmentSize * 100));
    const fill = row.querySelector(".station-progress-bar i");
    if (fill) fill.style.width = `${segmentProgress}%`;
    row.classList.toggle("complete", segmentProgress >= 100);
    row.classList.toggle("current", index === activeSegmentIndex && segmentProgress < 100);
  });
  const waitPanel = document.querySelector(".tracking-wait-panel");
  const activeSegment = document.querySelector(`.station-progress-segment[data-segment-index="${activeSegmentIndex}"]`);
  const activeBar = activeSegment?.querySelector(".station-progress-bar");
  if (waitPanel && activeSegment && activeBar) activeSegment.insertBefore(waitPanel, activeBar);
  document.querySelectorAll(".live-trip-card").forEach((card) => {
    if (card.dataset.tripId !== trip.id) return;
    const etaValue = card.querySelector(".live-trip-eta strong");
    const distanceValue = card.querySelector(".live-trip-eta small");
    if (etaValue) etaValue.textContent = `${trip.remainingMinutes} min`;
    if (distanceValue) distanceValue.textContent = `${trip.remainingKm.toFixed(1)} km`;
  });
  document.querySelectorAll("[data-wait-button]").forEach((button) => {
    if (button.dataset.tripId !== trip.id) return;
    const waiting = isWaitingForTrip(trip);
    button.textContent = `${translateText(waiting ? "Je n'attends plus ici" : "J'attends ici")} · ${trip.waitingPassengers || 0}`;
    button.setAttribute("aria-pressed", `${waiting}`);
  });
  document.querySelectorAll("[data-waiting-count]").forEach((count) => {
    if (count.dataset.tripId === trip.id) count.textContent = `${trip.waitingPassengers || 0}`;
  });
}

function readDriverForm() {
  driverMode = document.querySelector("#driver-mode")?.value || driverMode;
  driverLine = document.querySelector("#driver-line")?.value || driverLine;
  driverOrigin = document.querySelector("#driver-origin")?.value || driverOrigin;
  driverDestination = document.querySelector("#driver-destination")?.value || driverDestination;
  driverVehicle = document.querySelector("#driver-vehicle")?.value.trim() || driverVehicle;
  const companyField = document.querySelector("#driver-company");
  if (companyField) driverCompany = companyField.value.trim();
}

async function encodeDriverPhoto(file) {
  if (!file.type.startsWith("image/")) throw new Error("Le fichier sélectionné n'est pas une image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("La photo dépasse la taille maximale de 10 Mo.");

  let image;
  let objectUrl;
  if (window.createImageBitmap) {
    image = await window.createImageBitmap(file);
  } else {
    objectUrl = URL.createObjectURL(file);
    image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Le fichier image ne peut pas être décodé."));
      element.src = objectUrl;
    }).finally(() => URL.revokeObjectURL(objectUrl));
  }

  const maxSide = 960;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    image.close?.();
    throw new Error("Impossible de préparer l'aperçu de la photo.");
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  if (!blob) throw new Error("Impossible de compresser la photo sélectionnée.");
  if (blob.size > 700 * 1024) throw new Error("La photo compressée dépasse la taille maximale autorisée.");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("La photo compressée n'a pas pu être lue."));
    };
    reader.onerror = () => reject(reader.error || new Error("La photo compressée n'a pas pu être lue."));
    reader.readAsDataURL(blob);
  });
}

function updateDriverPhotoPreview() {
  const preview = document.querySelector("#driver-photo-preview");
  const image = preview?.querySelector("img");
  if (!preview || !image) return;
  preview.hidden = !driverPhoto;
  if (driverPhoto) image.src = driverPhoto;
}

function persistDriverSetup() {
  readDriverForm();
  if (driverOrigin === driverDestination) {
    showToast("Choisissez des arrêts de départ et d'arrivée différents.");
    return false;
  }
  preferences.driverMode = driverMode;
  preferences.driverLine = driverLine;
  preferences.driverOrigin = driverOrigin;
  preferences.driverDestination = driverDestination;
  preferences.driverVehicle = driverVehicle;
  preferences.driverCompany = driverCompany;
  preferences.driverPhoto = driverPhoto;
  preferences.driverSetupComplete = true;
  preferences.role = "Conducteur";
  savePreferences();
  return true;
}

function saveDriverRoute() {
  readDriverForm();
  if (driverOrigin === driverDestination) {
    showToast("Choisissez des arrêts de départ et d'arrivée différents.");
    return;
  }
  const savedRoutes = preferences.savedDriverRoutes || [];
  savedRoutes.unshift({
    id: `route-${Date.now()}`,
    mode: driverMode,
    line: driverLine,
    from: driverOrigin,
    to: driverDestination,
    vehicle: driverVehicle,
    company: driverCompany,
  });
  preferences.savedDriverRoutes = savedRoutes.slice(0, 20);
  preferences.driverCompany = driverCompany;
  preferences.driverPhoto = driverPhoto;
  savePreferences();
  driverFormOpen = false;
  render();
  showToast("Trajet enregistré dans votre liste.");
}

function startDriverTrip(savedRoute = null) {
  if (currentDriverTrip()) {
    showToast("Terminez d'abord votre trajet en cours.");
    return;
  }
  if (savedRoute) {
    driverMode = savedRoute.mode;
    driverLine = savedRoute.line;
    driverOrigin = savedRoute.from;
    driverDestination = savedRoute.to;
    driverVehicle = savedRoute.vehicle;
    driverCompany = savedRoute.company || preferences.driverCompany || "";
  } else {
    readDriverForm();
  }
  if (driverOrigin === driverDestination) {
    showToast("Choisissez des arrêts de départ et d'arrivée différents.");
    return;
  }
  const routeStops = routeStopsForTrip(driverMode, driverOrigin, driverDestination);
  const segmentDistances = routeSegmentDistances(driverMode, routeStops);
  const totalDistanceKm = Number(segmentDistances.reduce((total, distance) => total + distance, 0).toFixed(1)) || 2.4;
  const averageSpeed = modeSpeeds[driverMode] || 22;
  const totalMinutes = Math.max(4, Math.round(totalDistanceKm / averageSpeed * 60));
  const [latitude, longitude] = cityCoordinates[preferences.city] || cityCoordinates.Paris;
  const trip = {
    id: `trip-${Date.now()}`,
    code: `MM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    city: preferences.city,
    driver: preferences.name || "Conducteur invité",
    vehicle: driverVehicle,
    company: driverCompany,
    photo: driverPhoto || preferences.driverPhoto || "",
    mode: driverMode,
    line: driverLine,
    from: driverOrigin,
    to: driverDestination,
    routeStops,
    totalDistanceKm,
    totalMinutes,
    progressPercent: 0,
    speedKmh: averageSpeed,
    elapsedMinutes: 0,
    remainingMinutes: totalMinutes,
    remainingKm: totalDistanceKm,
    waitingPassengers: 0,
    latitude,
    longitude,
    status: "active",
    demo: false,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    approachAlertSent: false,
  };
  liveTrips = [trip, ...liveTrips.filter((item) => item.status === "active")];
  preferences.driverTripId = trip.id;
  preferences.role = "Conducteur";
  preferences.driverSetupComplete = true;
  preferences.driverMode = driverMode;
  preferences.driverLine = driverLine;
  preferences.driverOrigin = driverOrigin;
  preferences.driverDestination = driverDestination;
  preferences.driverVehicle = driverVehicle;
  preferences.driverCompany = driverCompany;
  preferences.driverPhoto = driverPhoto;
  savePreferences();
  saveLiveTrips();
  render();
  showToast("Trajet publié. Les passagers de cet appareil peuvent le suivre.");
  if (preferences.gps && navigator.geolocation) {
    locationWatchId = navigator.geolocation.watchPosition((position) => {
      const currentTrip = currentDriverTrip();
      if (!currentTrip) return;
      currentTrip.latitude = position.coords.latitude;
      currentTrip.longitude = position.coords.longitude;
      currentTrip.updatedAt = Date.now();
      saveLiveTrips();
      trackingMarker?.setLatLng([currentTrip.latitude, currentTrip.longitude]);
    }, () => {
      showToast("Position GPS indisponible : le trajet continue en mode simulé.");
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
  }
}

function progressActiveTrip() {
  const trip = currentDriverTrip() || followedTrip();
  if (!trip) {
    showToast("Aucun trajet actif à faire progresser.");
    return;
  }
  ensureTripProgress(trip);
  const totalMinutes = Number(trip.totalMinutes) || Number(trip.remainingMinutes) || 1;
  const totalDistanceKm = Number(trip.totalDistanceKm) || Number(trip.remainingKm) || 0;
  const step = Math.max(1, 100 / Math.max(1, totalMinutes / 3));
  trip.progressPercent = Math.min(100, (Number(trip.progressPercent) || 0) + step);
  trip.elapsedMinutes = Math.min(totalMinutes, (Number(trip.elapsedMinutes) || 0) + 3);
  trip.remainingMinutes = Math.max(0, Math.ceil(totalMinutes * (1 - trip.progressPercent / 100)));
  trip.remainingKm = Number((totalDistanceKm * (1 - trip.progressPercent / 100)).toFixed(1));
  trip.speedKmh = Math.round(trip.speedKmh || 0);
  trip.latitude += 0.001;
  trip.longitude += 0.001;
  trip.updatedAt = Date.now();
  saveLiveTrips();
  trackingMarker?.setLatLng([trip.latitude, trip.longitude]);
  updateTrackingValues(trip);
  const alertAlreadySent = trip.approachAlertSent;
  checkApproachAlert(trip);
  if (alertAlreadySent || !trip.approachAlertSent) showToast("Position et arrivée estimée mises à jour.");
}

function endDriverTrip() {
  const trip = currentDriverTrip();
  if (!trip) return;
  trip.status = "completed";
  trip.updatedAt = Date.now();
  preferences.driverTripId = "";
  if (locationWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
  saveLiveTrips();
  render();
  showToast("Trajet terminé et enregistré sur cet appareil.");
}

async function requestPushNotifications() {
  if (!("Notification" in window)) {
    showToast("Les notifications ne sont pas prises en charge par ce navigateur.");
    return;
  }
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") {
    preferences.pushEnabled = false;
    savePreferences();
    showToast(permission === "denied" ? "Autorisation refusée. Modifiez-la dans les réglages du navigateur." : "Autorisation des notifications non accordée.");
    render();
    return;
  }
  preferences.pushEnabled = true;
  savePreferences();
  await showBrowserNotification("myridemate", "Les notifications d'approche sont activées sur cet appareil.");
  render();
}

function header(title = "myridemate", options = {}) {
  const backButton = options.back ? `<button class="icon-button" data-action="back" aria-label="Retour">${icon("back")}</button>` : "";
  const isBrand = title === "myridemate";
  const pageTitle = isBrand ? "" : `<span class="header-page-title">${escapeHTML(title)}</span>`;
  const languageOptions = availableLanguages.map(([flag, language]) => `<option value="${escapeHTML(language)}" ${preferences.language === language ? "selected" : ""}>${flag} ${escapeHTML(language)}</option>`).join("");
  return `<header class="topbar">${backButton}<button class="brand brand-home" data-page="account" aria-label="Choisir Passager ou Conducteur">${icon("pin", 22)}<span>myridemate</span></button>${pageTitle}<div class="top-actions"><label class="header-language">${icon("globe", 15)}<select id="header-language" aria-label="Choisir la langue">${languageOptions}</select></label></div></header>`;
}

function bottomNav() {
  const items = [["home", "Carte", "pin"], ["trips", "Trajets", "route"], ["alerts", "Alertes", "bell"], ["favorites", "Favoris", "star"], ["settings", "Paramètres", "settings"], ["notifications", "Sons", "music"]];
  return `<nav class="bottom-nav" aria-label="Navigation principale">${items.map(([page, label, glyph]) => `<button class="nav-item ${activeTab === page ? "active" : ""}" data-tab="${page}" aria-label="${label}" aria-current="${activeTab === page ? "page" : "false"}">${icon(glyph, 19)}<span>${label}</span></button>`).join("")}</nav>`;
}

function mapArtwork() {
  return `<div id="route-osm-map" class="leaflet-map" data-map-kind="route" role="application" aria-label="Carte OpenStreetMap des arrêts à Paris"></div>`;
}

function homePage() {
  const featuredRoute = routes.find((route) => route.line === featuredByMode[selectedMode]) || routes[0];
  return `${header("myridemate")}
    <main class="map-page">
      <button class="location-pill" data-page="location">${icon("pin", 16)}<span>Position détectée automatiquement · ${escapeHTML(preferences.city)}</span><span class="status-dot"></span></button>
      <div class="search-bar" id="search-bar">${icon("search", 19)}<input id="destination-search" type="search" enterkeyhint="search" aria-label="Rechercher un arrêt, une ligne ou une adresse" placeholder="Rechercher un arrêt, une ligne..." value="${escapeHTML(currentQuery)}"></div>
      ${currentQuery ? `<div class="search-result"><span class="result-icon">${icon("pin")}</span><div><strong>${escapeHTML(currentQuery)}</strong><small>Destination · Paris</small></div><button data-action="plan-route">Itinéraire ${icon("arrow", 15)}</button></div>` : ""}
      <div class="section-heading"><h2>À proximité</h2><button class="text-button" data-page="schedules">Tout voir ${icon("arrow", 15)}</button></div>
      <div class="mode-chips transit-mode-grid">${transitModes.map((mode) => `<button class="mode-chip ${selectedMode === mode ? "selected" : ""}" data-mode="${mode}" data-mode-icon="${modeIcon(mode)}">${icon(modeIcon(mode), 16)}<span>${mode}</span></button>`).join("")}</div>
      <div class="map-wrap"><div id="home-osm-map" class="leaflet-map" data-map-kind="home" role="application" aria-label="Carte OpenStreetMap des transports à proximité"></div><button class="map-expand" data-action="enter-full-map" aria-label="Ouvrir la carte en plein écran">${icon("expand", 18)}</button></div>
      <section class="arrival-card">
        <div class="arrival-icon">${icon(featuredRoute.kind, 20)}</div>
        <div class="arrival-copy"><strong>${featuredRoute.line} <span class="live-dot"></span></strong><small>Direction ${escapeHTML(featuredRoute.to)}</small><span class="arrival-destination">Prochain passage dans <b>${featuredRoute.time}</b> · ${escapeHTML(featuredRoute.from)}</span></div>
        <button class="card-arrow" data-action="show-route" data-line="${featuredRoute.line}" aria-label="Voir les détails">${icon("arrow", 18)}</button>
      </section>
    </main>`;
}

function fullMapPage() {
  return `<main class="fullscreen-map-stage">
    <div id="fullscreen-osm-map" class="leaflet-map" data-map-kind="full" role="application" aria-label="Carte OpenStreetMap interactive"></div>
    ${header()}
    <div class="fullscreen-map-top"><button class="quit-map-button" data-action="exit-full-map">${icon("close", 19)} Quitter</button><button class="fullscreen-search" data-page="itinerary">${icon("search", 18)} Où allez-vous ?</button><button class="fullscreen-location" data-action="locate" aria-label="Me localiser">${icon("location")}</button></div>
    <div class="fullscreen-map-bottom"><div class="fullscreen-map-title"><span class="live-dot"></span><span><strong>Autour de ${escapeHTML(preferences.city)}</strong><small>Transports et trajets partagés à proximité</small></span><button data-page="schedules">Horaires ${icon("arrow", 15)}</button></div><div class="fullscreen-mode-row">${transitModes.map((mode) => `<button class="fullscreen-mode ${selectedMode === mode ? "selected" : ""}" data-mode="${mode}">${icon(modeIcon(mode), 15)}${mode}</button>`).join("")}</div></div>
  </main>`;
}

function addOSMMarker(map, position, label, type = "stop") {
  const markerGlyph = type === "bus" ? icon("bus", 15) : type === "metro" ? "M" : type === "ferry" ? icon("ferry", 15) : type === "cablecar" ? icon("cablecar", 15) : type === "car" ? icon("car", 15) : icon("pin", 15);
  const markerIcon = window.L.divIcon({
    className: "",
    html: `<span class="osm-marker osm-marker-${type}">${markerGlyph}</span>`,
    iconSize: [34, 38],
    iconAnchor: [17, 34],
  });
  return window.L.marker(position, { icon: markerIcon }).addTo(map).bindPopup(`<strong>${escapeHTML(label)}</strong><br><span>${escapeHTML(translateText("Information de démonstration"))}</span>`);
}

function initializeMap(element) {
  if (!element || !window.L) {
    if (element) element.innerHTML = `<div class="map-load-fallback"><strong>${escapeHTML(translateText("Carte momentanément indisponible"))}</strong><span>${escapeHTML(translateText("Connectez-vous à Internet pour afficher OpenStreetMap."))}</span><a href="https://www.openstreetmap.org/#map=13/48.8566/2.3522" target="_blank" rel="noreferrer">${escapeHTML(translateText("Ouvrir OpenStreetMap"))}</a></div>`;
    return;
  }

  const kind = element.dataset.mapKind;
  const trip = kind === "tracking" ? followedTrip() : null;
  const center = trip ? [trip.latitude, trip.longitude] : cityCoordinates[preferences.city] || cityCoordinates.Paris;
  const map = window.L.map(element, { zoomControl: false, scrollWheelZoom: kind === "full", tap: true }).setView(center, kind === "full" ? 14 : kind === "route" ? 13 : 12);
  mapInstances[element.id] = map;
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
  }).addTo(map);
  if (kind === "full") window.L.control.zoom({ position: "topleft" }).addTo(map);

  const paris = preferences.city === "Paris";
  if (kind === "tracking" && trip) {
    map.setView(center, 15);
    const markerType = trip.mode === "Ferry" ? "ferry" : trip.mode === "Téléphérique" ? "cablecar" : ["Taxi", "Covoiturage"].includes(trip.mode) ? "car" : trip.mode === "Métro" ? "metro" : "bus";
    trackingMarker = addOSMMarker(map, center, `${trip.line} · ${trip.code}`, markerType);
    const plan = routePlans[featuredByMode[trip.mode]] || routePlans["Bus 87"];
    const destination = trip.city === "Paris" ? plan.stops.at(-1).position : [center[0] + .02, center[1] + .015];
    window.L.polyline([center, destination], { color: plan.color, weight: 5, opacity: .8, dashArray: "8 8" }).addTo(map);
    addOSMMarker(map, destination, trip.to, "stop");
  } else if (paris && (kind === "home" || kind === "full")) {
    const plan = routePlans[featuredByMode[selectedMode]] || routePlans["Bus 87"];
    const linePoints = plan.stops.map((stop) => stop.position);
    window.L.polyline(linePoints, { color: plan.color, weight: 5, opacity: .8, lineCap: "round" }).addTo(map);
    plan.stops.forEach((stop, index) => addOSMMarker(map, stop.position, stop.name, index === 0 ? (selectedMode === "Ferry" ? "ferry" : selectedMode === "Métro" ? "metro" : selectedMode === "Téléphérique" ? "cablecar" : "bus") : "stop"));
    addOSMMarker(map, [48.8613, 2.3391], "Louvre · Métro", "metro");
    addOSMMarker(map, [48.853, 2.369], "Bastille · Bus 87", "bus");
  } else if (paris) {
    const plan = routePlans[selectedRoute] || routePlans["Bus 87"];
    const route = plan.stops.map((stop) => stop.position);
    window.L.polyline(route, { color: plan.color, weight: 5, opacity: .85, lineCap: "round" }).addTo(map);
    plan.stops.forEach((stop, index) => addOSMMarker(map, stop.position, stop.name, index === 0 ? (selectedRoute.startsWith("Métro") ? "metro" : "bus") : "stop"));
    map.fitBounds(window.L.latLngBounds(route).pad(.2));
  } else {
    addOSMMarker(map, center, `Centre de ${preferences.city}`, "bus");
    addOSMMarker(map, [center[0] + .012, center[1] + .01], `Arrêt principal · ${preferences.city}`, "stop");
  }

  map.on("tileerror", () => {
    if (element.dataset.tileError) return;
    element.dataset.tileError = "true";
    const notice = document.createElement("div");
    notice.className = "map-tile-notice";
    notice.textContent = translateText("Fond de carte OSM indisponible · vérifiez votre connexion");
    element.append(notice);
  });
  map.on("locationfound", (event) => {
    addOSMMarker(map, event.latlng, "Votre position", "you");
    map.setView(event.latlng, Math.max(map.getZoom(), 15));
  });
  map.on("locationerror", () => showToast("Autorisez la localisation dans votre navigateur pour vous situer."));
}

function initializeVisibleMaps() {
  document.querySelectorAll(".leaflet-map").forEach(initializeMap);
}

function destroyMaps() {
  Object.values(mapInstances).forEach((map) => map.remove());
  mapInstances = {};
  trackingMarker = null;
}

function alertsPage() {
  const alerts = [
    ["bus", "Bus 87", "Arrivée dans 3 min à Châtelet", "09:30", "blue", "Trajets"],
    ["route", "Trajet en cours", "Votre véhicule est en mouvement", "09:20", "green", "Trajets"],
    ["bell", "Alerte météo", "Pluie prévue à partir de 14 h", "09:15", "orange", "Système"],
    ["user", "Nouveau message", "Votre conducteur vous a écrit", "07:50", "purple", "Trajets"],
    ["route", "Mise à jour", "Ligne 6 · changement d'itinéraire", "Hier", "red", "Système"],
  ];
  const visibleAlerts = alerts.filter((alert) => alertFilter === "Toutes" || alert[5] === alertFilter);
  return `${header("Notifications")}<main class="content-page">${photoBanner("metro", "Vos trajets, à jour", "Toutes les alertes de vos transports collectifs") }<div class="segmented">${["Toutes", "Trajets", "Système"].map((filter) => `<button class="${alertFilter === filter ? "selected" : ""}" data-action="alert-filter" data-filter="${filter}">${filter}</button>`).join("")}</div><div class="notification-list">${visibleAlerts.map(([glyph, title, text, time, color]) => `<button class="notification-item" data-action="open-alert"><span class="notification-icon ${color}">${icon(glyph)}</span><span class="notification-copy"><strong>${title}</strong><small>${text}</small></span><span class="notification-time">${time}</span></button>`).join("")}</div><div class="notice-card">${icon("shield")}<p>Tout est à jour.<br><small>Vous recevrez ici les alertes importantes de vos trajets.</small></p></div></main>`;
}

function favoritesPage() {
  const favorites = preferences.favoriteRoutes || [];
  return `${header("Mes favoris")}<main class="content-page">${photoBanner("train", "Vos lignes préférées", "Retrouvez facilement vos transports habituels")}<div class="section-heading"><h2>Vos lignes favorites</h2><button class="text-button" data-page="home">Explorer ${icon("arrow", 15)}</button></div>${favorites.length ? `<div class="trip-history">${favorites.map((line) => tripCard(line, "Gare de Lyon → Châtelet", "Suivi en temps réel", "3 min", line.startsWith("Métro") ? "red" : "blue")).join("")}</div>` : `<div class="empty-state"><span>${icon("star", 29)}</span><h2>Vos trajets préférés, ici</h2><p>Ajoutez une ligne à vos favoris depuis ses détails pour la retrouver rapidement.</p><button class="button button-primary" data-page="home">Explorer la carte ${icon("arrow", 16)}</button></div>`}</main>`;
}

function driverRouteForm(setup = false) {
  const lines = scheduleOptions[driverMode] || scheduleOptions.Bus;
  if (!lines.includes(driverLine)) driverLine = lines[0];
  const options = preferences.city === "Paris"
    ? scheduleStopsByMode[driverMode] || scheduleStopsByMode.Bus
    : [`Centre de ${preferences.city}`, "Gare principale", "Station centrale"];
  return `<section class="driver-recorder"><div class="recorder-heading"><span class="recorder-icon">${icon("route", 24)}</span><span><strong>${setup ? "Configurez votre service" : "Détails du nouveau trajet"}</strong><small>${setup ? "Ces informations seront proposées pour vos prochains trajets." : "Enregistrez les arrêts pour que les passagers puissent suivre votre véhicule."}</small></span></div>
    <label class="form-label">Moyen de transport<select id="driver-mode">${transitModes.map((mode) => `<option value="${escapeHTML(mode)}" ${driverMode === mode ? "selected" : ""}>${mode}</option>`).join("")}</select></label>
    <label class="form-label">Ligne / service<select id="driver-line">${lines.map((line) => `<option ${driverLine === line ? "selected" : ""}>${escapeHTML(line)}</option>`).join("")}</select></label>
    <label class="form-label">Départ<select id="driver-origin">${options.map((stop, index) => `<option ${(driverOrigin || (index === 0 ? stop : "")) === stop ? "selected" : ""}>${escapeHTML(stop)}</option>`).join("")}</select></label>
    <label class="form-label">Destination<select id="driver-destination">${options.map((stop, index) => `<option ${(driverDestination || (index === 1 ? stop : "")) === stop ? "selected" : ""}>${escapeHTML(stop)}</option>`).join("")}</select></label>
    <label class="form-label">Véhicule / identifiant<input id="driver-vehicle" value="${escapeHTML(driverVehicle)}" placeholder="Ex. Bus 24 · Véhicule 102"></label>
    <label class="form-label">Compagnie (facultatif)<input id="driver-company" value="${escapeHTML(driverCompany)}" placeholder="Ex. Réseau de transport"></label>
    <label class="form-label driver-photo-label">Photo du transport (facultatif)<input id="driver-photo-input" class="driver-photo-input" type="file" accept="image/*"></label>
    <div id="driver-photo-preview" class="driver-photo-preview" ${driverPhoto ? "" : "hidden"}><img src="${escapeHTML(driverPhoto)}" alt="Aperçu de la photo du transport"><button class="button button-soft" type="button" data-action="clear-driver-photo">Supprimer la photo</button></div>
    ${setup
      ? `<button class="button button-primary full-width" data-action="save-driver-setup">Enregistrer la configuration ${icon("arrow", 16)}</button>`
      : `<button class="button button-soft full-width" data-action="save-driver-route">Enregistrer ce trajet</button><button class="button button-primary full-width" data-action="start-trip">${icon("play", 17)} Démarrer et partager</button>`}
    <p class="helper-text">Simulation locale : sans serveur, le trajet est visible sur les onglets de cet appareil uniquement.</p>
  </section>`;
}

function driverSetupPage() {
  return `${header("Configuration conducteur", { back: true })}<main class="content-page driver-page">${photoBanner("bus", "Bienvenue conducteur", "Configurez votre véhicule et votre ligne", driverPhoto)}${driverRouteForm(true)}</main>`;
}

function tripsPage() {
  if (preferences.role === "Conducteur") {
    if (!preferences.driverSetupComplete) return driverSetupPage();
    const trip = currentDriverTrip();
    const savedRoutes = preferences.savedDriverRoutes || [];
    return `${header(trip ? "Trajet partagé en direct" : "Mes trajets")}<main class="content-page driver-page">${photoBanner("bus", trip ? "Votre véhicule est en service" : "Partagez votre ligne", "Les passagers peuvent suivre le véhicule en direct", trip?.photo || driverPhoto)}
      ${trip ? `<section class="trip-live-card driver-recording"><span class="live-pill"><i></i> EN DIRECT</span><div class="large-bus-icon">${icon(modeIcon(trip.mode), 28)}</div><span class="demo-badge">${trip.demo ? "SIMULATION" : "PARTAGÉ AUX PASSAGERS"}</span><h2>${escapeHTML(trip.line)}</h2><p>${escapeHTML(trip.from)} → ${escapeHTML(trip.to)}</p><div class="share-code"><small>CODE DE SUIVI</small><strong>${escapeHTML(trip.code)}</strong></div><div class="trip-stats"><span><b id="driver-eta">${trip.remainingMinutes} min</b> restantes</span><span><b id="driver-distance">${trip.remainingKm.toFixed(1)} km</b> à parcourir</span></div>${tripProgressMarkup(trip)}<div class="driver-waiting-count"><strong><span data-waiting-count data-trip-id="${escapeHTML(trip.id)}">${trip.waitingPassengers || 0}</span></strong><small>passager(s) attendent sur cette ligne</small></div><button class="button button-soft full-width" data-action="progress-trip">Simuler une progression</button><button class="button button-danger full-width" data-action="end-trip">Terminer et enregistrer</button></section>` : `<section class="driver-dashboard-actions"><button class="button button-primary full-width" data-action="new-driver-route">${icon("route", 17)} Enregistrer un nouveau trajet</button><button class="button button-soft full-width" data-action="start-auto-trip">${icon("play", 17)} Démarrer automatiquement</button><small>Le trajet automatique reprend votre configuration actuelle.</small></section>
        ${driverFormOpen ? driverRouteForm() : ""}
        <div class="section-heading"><h2>Mes trajets enregistrés</h2><span>${savedRoutes.length}</span></div>
        ${savedRoutes.length ? `<div class="saved-driver-routes">${savedRoutes.map((route) => `<article class="saved-driver-route"><span class="transport-icon blue">${icon(modeIcon(route.mode))}</span><span><strong>${escapeHTML(route.line)}</strong><small>${escapeHTML(route.from)} → ${escapeHTML(route.to)}</small></span><button class="button button-soft" data-action="start-saved-route" data-route-id="${escapeHTML(route.id)}">Démarrer</button></article>`).join("")}</div>` : `<p class="helper-text">Aucun trajet enregistré. Configurez-en un pour le retrouver ici.</p>`}`}
      <div class="section-heading"><h2>Trajets visibles par les passagers</h2><span class="live-pill"><i></i> ${activeTrips().length} actif(s)</span></div>${activeTrips().filter((item) => item.id !== trip?.id).map((item) => liveTripCard(item)).join("")}
    </main>`;
  }

  const trips = activeTrips();
  return `${header("Trajets partagés")}<main class="content-page passenger-trips-page">${photoBanner("metro", "Un trajet collectif vous attend", "Suivez les lignes partagées par les conducteurs")}
    <div class="section-heading live-section-heading"><div><h2>À suivre maintenant</h2><small>Trajets enregistrés par les conducteurs</small></div><span class="live-pill"><i></i> EN DIRECT</span></div>
    ${trips.length ? `<div class="live-trip-list">${trips.map((trip) => liveTripCard(trip, true)).join("")}</div>` : `<div class="empty-state"><span>${icon("route", 29)}</span><h2>Aucun trajet partagé pour le moment</h2><p>Les trajets publiés par les conducteurs apparaîtront ici.</p><button class="button button-soft" data-action="refresh-trips">Actualiser ${icon("arrow", 15)}</button></div>`}
    <div class="section-heading"><h2>Vos trajets récents</h2><button class="text-button" data-action="new-route">Planifier ${icon("arrow", 15)}</button></div>
    <div class="trip-history">${tripCard("Bus 87", "Gare de Lyon → Châtelet", "Aujourd'hui · 09:12", "18 min", "blue")}${tripCard("Métro 6", "Bir-Hakeim → Montparnasse", "Hier · 18:34", "21 min", "red")}${tripCard("Batobus Seine", "Hôtel de Ville → Tour Eiffel", "Hier · 17:20", "35 min", "blue")}</div>
    <section class="driver-banner"><span class="driver-banner-icon">${icon("car", 25)}</span><div><strong>Vous conduisez ?</strong><small>Enregistrez un trajet pour le partager.</small></div><button class="text-button" data-action="switch-driver">${icon("arrow", 18)}</button></section>
  </main>`;
}

function liveTripCard(trip, follower = false) {
  const selectedRoute = routes.find((route) => route.line === trip.line);
  const color = selectedRoute?.color || "blue";
  const company = trip.company ? ` · ${escapeHTML(trip.company)}` : "";
  return `<article class="live-trip-card" data-trip-id="${escapeHTML(trip.id)}">
    <button class="live-trip-main" data-action="${follower ? "follow-trip" : "show-tracking"}" data-trip-id="${escapeHTML(trip.id)}"><span class="transport-icon ${color}">${icon(modeIcon(trip.mode))}</span><span class="live-trip-copy"><span><strong>${escapeHTML(trip.line)}</strong><i class="live-indicator"></i>${trip.demo ? "<em>Démo</em>" : ""}</span><small>${escapeHTML(trip.from)} → ${escapeHTML(trip.to)}</small><small class="muted">${escapeHTML(trip.driver)}${company} · ${escapeHTML(trip.code)}</small></span>
    <span class="live-trip-eta"><strong>${trip.remainingMinutes} min</strong><small>${trip.remainingKm.toFixed(1)} km</small>${icon("arrow", 15)}</span></button>
    <div class="live-trip-footer"><span><strong data-waiting-count data-trip-id="${escapeHTML(trip.id)}">${trip.waitingPassengers || 0}</strong> passager(s) attendent</span><button class="wait-here-button ${isWaitingForTrip(trip) ? "selected" : ""}" data-action="wait-for-trip" data-wait-button data-trip-id="${escapeHTML(trip.id)}" aria-pressed="${isWaitingForTrip(trip)}">${isWaitingForTrip(trip) ? "Je n'attends plus ici" : "J'attends ici"} · ${trip.waitingPassengers || 0}</button></div>
  </article>`;
}

function trackingPage() {
  const trip = followedTrip();
  if (!trip) return `${header("Trajet terminé", { back: true })}<main class="content-page"><div class="empty-state"><span>${icon("route", 28)}</span><h2>Ce trajet n'est plus actif</h2><button class="button button-primary" data-tab="trips">Voir les trajets</button></div></main>`;
  const photo = photoScenes[photoSceneForMode(trip.mode)];
  const photoSource = trip.photo || photo.src;
  return `${header("Suivi en direct", { back: true })}<main class="content-page tracking-page">
    <section class="tracking-vehicle-banner" aria-label="Transport suivi">
      <img src="${escapeHTML(photoSource)}" alt="${escapeHTML(translateText(trip.photo ? "Photo du transport" : photo.alt))}" loading="eager">
      <div class="tracking-vehicle-shade"></div>
      <span class="live-pill"><i></i> EN DIRECT</span>
      <div class="tracking-vehicle-copy"><strong>${escapeHTML(trip.line)}</strong><small>${escapeHTML(trip.from)} → ${escapeHTML(trip.to)}</small></div>
      <span class="tracking-vehicle-mode">${escapeHTML(trip.mode)}</span>
    </section>
    <section class="tracking-card"><div class="tracking-card-top"><span>${trip.demo ? "Trajet de démonstration" : `Conducteur · ${escapeHTML(trip.driver)}${trip.company ? ` · ${escapeHTML(trip.company)}` : ""}`}</span><span class="approach-summary">${icon("bell", 16)} Alerte réglée à ${preferences.approachTimeMinutes} min ou ${formatDistance(preferences.approachDistanceKm)}</span></div></section>
    ${tripProgressMarkup(trip, true)}
    <button class="button button-primary full-width" data-action="progress-trip">${icon("route", 17)} Simuler la progression du trajet</button>
    <button class="text-button tracking-stop" data-action="stop-follow">Arrêter le suivi</button>
    <p class="helper-text">Démonstration locale : positions et horaires simulés.</p>
  </main>`;
}

function formatDistance(kilometers) {
  return kilometers < 1 ? `${Math.round(kilometers * 1000)} m` : `${Number(kilometers).toFixed(1)} km`;
}

function tripCard(line, description, time, duration, color) {
  const route = routes.find((item) => item.line === line);
  return `<button class="trip-card" data-action="show-route" data-line="${line}"><span class="transport-icon ${color}">${icon(route?.kind || "bus")}</span><span class="trip-card-copy"><strong>${line}</strong><small>${description}</small><small class="muted">${time}</small></span><span class="trip-duration">${duration}<br>${icon("arrow", 14)}</span></button>`;
}

function routePage() {
  const route = routes.find((entry) => entry.line === selectedRoute) || routes[0];
  const isFavorite = (preferences.favoriteRoutes || []).includes(route.line);
  return `${header("Détails du trajet", { back: true })}<main class="content-page route-detail">${photoBanner(route.kind === "ferry" ? "ferry" : route.kind === "train" ? "train" : "bus", route.line, `${route.from} · ${route.to}`)}
    <div class="route-hero">${mapArtwork()}<div class="route-hero-label"><span class="transport-icon ${route.color}">${icon(route.kind)}</span><div><strong>${route.line}</strong><small>Direction ${route.to}</small></div><button class="favorite-button ${isFavorite ? "favorited" : ""}" data-action="favorite" aria-label="${isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}">${icon("star")}</button></div></div>
    <section class="route-summary"><p class="eyebrow">PROCHAINS PASSAGES</p><h2>Arrêt ${route.from}</h2><div class="arrival-times"><span><i></i><b>${route.time}</b></span><span><i></i>12 min</span><span><i></i>18 min</span></div></section>
    <section class="stop-list">${stops.map((stop, index) => `<div class="stop-item ${index === 0 ? "current" : ""}"><span class="stop-rail"><i></i></span><span>${stop}</span>${index === 0 ? `<small>${route.time}</small>` : ""}</div>`).join("")}</section>
    <div class="route-actions"><button class="button button-primary full-width" data-action="show-map">${icon("pin", 18)} Suivre sur la carte</button><button class="button button-soft full-width" data-action="share-route">${icon("arrow", 17)} Partager le trajet</button></div>
  </main>`;
}

function itineraryPage() {
  return `${header("Itinéraire", { back: true })}<main class="content-page">${photoBanner("city", "Choisissez votre trajet", "Bus, métro, train, ferry et plus encore")}
    <div class="journey-fields"><label class="journey-field"><span class="field-dot blue-dot"></span><span><small>Ma position actuelle</small><input aria-label="Point de départ" value="${escapeHTML(preferences.city)}"></span>${icon("location", 16)}</label><div class="journey-divider"></div><label class="journey-field"><span class="field-dot dark-dot"></span><span><small>Destination</small><input id="itinerary-destination" placeholder="Où souhaitez-vous aller ?" value="${escapeHTML(currentQuery || "République")}"></span>${icon("pin", 16)}</label></div>
    <div class="section-heading"><h2>Choisir un mode</h2></div><div class="mode-chips transit-mode-grid">${transitModes.map((mode) => `<button class="mode-chip ${selectedMode === mode ? "selected" : ""}" data-mode="${mode}" data-mode-icon="${modeIcon(mode)}">${icon(modeIcon(mode), 16)}<span>${mode}</span></button>`).join("")}</div>
    <button class="button button-primary full-width plan-button" data-action="plan-route">${icon("search", 18)} Rechercher un itinéraire</button>
    <div class="section-heading departures-heading"><h2>Prochains départs</h2><button class="text-button" data-page="schedules">Horaires ${icon("arrow", 15)}</button></div>
    <div class="departure-list">${routes.map((route) => `<button class="departure-row" data-action="show-route" data-line="${route.line}"><span class="transport-icon ${route.color}">${icon(route.kind)}</span><span><strong>${route.line}</strong><small>${route.from} → ${route.to}</small></span><span class="next-time">${route.time}</span></button>`).join("")}</div>
  </main>`;
}

function schedulesPage() {
  const lines = scheduleOptions[selectedMode];
  if (!lines.includes(selectedScheduleLine)) selectedScheduleLine = lines[0];
  const city = preferences.city || "Paris";
  const scheduleStops = scheduleStopsByMode[selectedMode] || scheduleStopsByMode.Bus;
  const date = new Date();
  const dateValue = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return `${header("Horaires & réservations", { back: true })}<main class="content-page">${photoBanner(selectedMode === "Ferry" ? "ferry" : selectedMode === "Train" || selectedMode === "Funiculaire" ? "train" : "bus", "Horaires des lignes", `Départs et arrêts · ${selectedMode}`)}
    <div class="mode-chips schedule-modes">${transitModes.map((mode) => `<button class="mode-chip ${selectedMode === mode ? "selected" : ""}" data-mode="${mode}" data-mode-icon="${modeIcon(mode)}">${icon(modeIcon(mode), 15)}${mode}</button>`).join("")}</div>
    <label class="select-row">${icon("pin")}<select id="schedule-city" aria-label="Ville">${Object.keys(cityCoordinates).map((name) => `<option ${city === name ? "selected" : ""}>${escapeHTML(name)}</option>`).join("")}</select>${icon("arrow")}</label>
    <label class="select-row">${icon(modeIcon(selectedMode))}<select id="schedule-line" aria-label="Ligne">${lines.map((line) => `<option ${selectedScheduleLine === line ? "selected" : ""}>${escapeHTML(line)}</option>`).join("")}</select>${icon("arrow")}</label>
    <div class="date-time-fields"><label class="select-row">${icon("clock")}<input type="date" aria-label="Date" value="${dateValue}"></label><label class="select-row">${icon("clock")}<input type="time" aria-label="Heure" value="${date.toTimeString().slice(0, 5)}"></label></div>
    <button class="button button-primary full-width" data-action="search-schedules">${icon("search", 18)} Rechercher</button>
    <div class="section-heading departures-heading"><h2>Prochains départs</h2><span class="text-button">${escapeHTML(city)}</span></div>
    <div class="departure-table">${scheduleStops.map((stop, index) => `<div><b>${["10:03", "10:12", "10:18", "10:26"][index]}</b><span>${escapeHTML(stop)}</span><i>${[3, 12, 18, 26][index]} min</i></div>`).join("")}</div>
  </main>`;
}

function settingOptions() {
  const themeName = { light: "Mode clair", dark: "Mode sombre", ocean: "Océan", forest: "Forêt" }[preferences.theme] || "Mode clair";
  return [
    ["Langue", "globe", "language", preferences.language],
    ["Pays", "pin", "location", preferences.country],
    ["Ville", "pin", "location", preferences.city],
    ["Type de transport", "route", "schedules", selectedMode],
    ["Notifications sonores", "bell", "notifications", preferences.pushEnabled ? "Push activées" : "Configurer"],
    ["Apparence", "moon", "appearance", themeName],
    ["Confidentialité", "shield", "privacy", ""],
    ["Aide & Support", "help", "help", ""],
  ];
}

function notificationsPage() {
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  const pushLabel = permission === "granted" ? "Notifications autorisées" : permission === "denied" ? "Bloquées par le navigateur" : "Autoriser les notifications";
  const timeOptions = [5, 10, 15, 20, 30, 45, 60];
  const distanceOptions = [.5, 1, 2, 5, 10, 15, 20, 30];
  return `${header("Sons & notifications", { back: true })}<main class="content-page notification-settings-page">${photoBanner("train", "Restez informé", "Une alerte au bon moment sur votre trajet")}
    <div class="notification-intro"><span class="notification-intro-icon">${icon("bell", 24)}</span><div><h2>Ne manquez pas votre arrêt</h2><p>Choisissez comment être averti à l'approche du véhicule.</p></div></div>
    <section class="notification-setting-card push-card"><div class="push-copy"><strong>Notifications push</strong><small>${escapeHTML(pushLabel)} · permission de votre appareil</small></div><button class="button ${permission === "granted" ? "button-soft" : "button-primary"}" data-action="request-push">${permission === "granted" ? "Tester" : "Activer"}</button></section>
    <section class="notification-setting-card"><div class="setting-card-title"><span class="setting-icon">${icon("bell")}</span><div><strong>Son de notification</strong><small>20 sonneries à écouter</small></div></div><div class="sound-preview-row"><select id="notification-sound" aria-label="Son de notification">${notificationSounds.map((sound) => `<option value="${escapeHTML(sound.name)}" ${preferences.notificationSound === sound.name ? "selected" : ""}>${escapeHTML(sound.name)}</option>`).join("")}</select><button class="preview-sound-button" data-action="preview-sound" aria-label="Écouter le son">${icon("play", 18)}</button></div><label class="range-label" for="notification-volume"><span>Volume</span><strong id="volume-value">${preferences.notificationVolume}%</strong></label><input id="notification-volume" class="range-control" type="range" min="0" max="100" step="1" value="${preferences.notificationVolume}"><div class="range-ends"><span>Silencieux</span><span>Fort</span></div></section>
    <section class="notification-setting-card"><div class="setting-card-title"><span class="setting-icon">${icon("vibration")}</span><div><strong>Vibreur</strong><small>Vibrer avec le son d'approche</small></div><button class="toggle ${preferences.vibrationEnabled ? "on" : ""}" data-action="toggle-vibration" aria-label="Activer le vibreur"></button></div><label class="form-label vibration-intensity">Intensité des impulsions<select id="vibration-intensity">${["faible", "moyenne", "forte"].map((level) => `<option value="${level}" ${preferences.vibrationIntensity === level ? "selected" : ""}>${level}</option>`).join("")}</select></label><p class="helper-text">La durée des vibrations dépend des capacités du téléphone.</p></section>
    <section class="notification-setting-card approach-card"><div class="setting-card-title"><span class="setting-icon">${icon("route")}</span><div><strong>Alerte d'approche</strong><small>Alerter dès qu'un seuil est atteint</small></div></div><label class="form-label">Avant l'arrivée<select id="approach-time">${timeOptions.map((minutes) => `<option value="${minutes}" ${Number(preferences.approachTimeMinutes) === minutes ? "selected" : ""}>${minutes} minutes</option>`).join("")}</select></label><label class="form-label">Ou à moins de<select id="approach-distance">${distanceOptions.map((km) => `<option value="${km}" ${Number(preferences.approachDistanceKm) === km ? "selected" : ""}>${formatDistance(km)}</option>`).join("")}</select></label><div class="approach-rule">${icon("bell", 15)} Le premier seuil atteint déclenche l'alerte.</div></section>
    <div class="push-disclosure">Les notifications de cette démo sont locales à cet appareil. Le push lorsque l'application est fermée ou entre téléphones nécessite un serveur push.</div>
  </main>`;
}

function welcomePage() {
  const photo = photoScenes.city;
  return `${header()}<main class="welcome-page"><img class="welcome-background-photo" src="${escapeHTML(photo.src)}" alt="${escapeHTML(photo.alt)}"><div class="welcome-brand">${icon("pin", 52)}<h1>myridemate</h1><p>Explore. Ride. Connect.</p></div><div class="welcome-bottom"><h2>Chaque trajet<br>vous rapproche.</h2><p>La mobilité en ville, sans inscription.</p><button class="button button-primary full-width" data-page="account">Découvrir ${icon("arrow", 17)}</button><button class="welcome-signin" data-action="continue-guest">Continuer en mode invité</button></div></main>`;
}

function accountPage() {
  return `${header("Choisissez votre mode", { back: true })}<main class="content-page account-choice">${photoBanner("bus", "myridemate", "Utilisez l'application sans créer de compte")}<div class="account-brand">${icon("pin", 35)}<h1>myridemate</h1><p>Utilisez l'application sans créer de compte.</p></div><button class="role-card passenger-role" data-action="choose-passenger"><span>${icon("user", 28)}</span><span><strong>Passager</strong><small>Explorez les lignes et planifiez vos trajets.</small></span>${icon("arrow")}</button><button class="role-card" data-action="choose-driver"><span>${icon("car", 28)}</span><span><strong>Conducteur</strong><small>Simulez le suivi de votre véhicule.</small></span>${icon("arrow")}</button><button class="button button-soft full-width guest-button" data-action="continue-guest">Continuer anonymement</button><p class="guest-note">Vos préférences sont conservées uniquement sur cet appareil.</p></main>`;
}

function settingsPage() {
  return `${header("Paramètres")}<main class="content-page settings-page">${photoBanner("skyline", "Personnalisez myridemate", "Vos préférences de mobilité, réunies au même endroit")}
    <button class="account-card" data-page="profile"><span class="account-avatar">${icon("user", 25)}</span><span><strong>Profil invité</strong><small>${escapeHTML(preferences.role)} · sans inscription</small><small>Données conservées sur cet appareil</small></span>${icon("arrow")}</button>
    <div class="settings-list">${settingOptions().map(([label, glyph, page, value]) => `<button class="setting-row" data-page="${page}"><span class="setting-icon">${icon(glyph, 18)}</span><span>${label}</span>${value ? `<small>${escapeHTML(value)}</small>` : ""}${icon("arrow", 16)}</button>`).join("")}
      <button class="setting-row" data-page="emergency"><span class="setting-icon emergency-setting">${icon("shield", 18)}</span><span>Alerte / Urgence</span>${icon("arrow", 16)}</button>
      <button class="setting-row" data-page="offline"><span class="setting-icon">${icon("download", 18)}</span><span>Cartes hors ligne</span>${preferences.downloaded ? `<small>${escapeHTML(preferences.city)} prêt</small>` : ""}${icon("arrow", 16)}</button>
      <button class="setting-row" data-page="${preferences.role === "Conducteur" ? "driver-setup" : "profile"}"><span class="setting-icon">${icon("user", 18)}</span><span>Mon profil conducteur</span>${icon("arrow", 16)}</button>
    </div><button class="button button-soft full-width" data-action="install">${icon("download", 17)} Installer l'application</button>
    <p class="version-label">myridemate · Version 1.0.0</p>
  </main>`;
}

function locationPage() {
  const country = citiesByCountry[preferences.country] ? preferences.country : "France";
  const cities = citiesByCountry[country];
  if (!cities.includes(preferences.city)) preferences.city = cities[0];
  const regions = [...new Set(cities.map((city) => regionsByCity[city]))];
  if (!regions.includes(preferences.region)) preferences.region = regionsByCity[preferences.city];
  return `${header("Localisation", { back: true })}<main class="content-page form-page">${photoBanner("city", "Déplacements en ville", "Choisissez votre zone de transport")}
    <div class="illustration-bubble">${icon("pin", 34)}</div><div class="page-intro"><h2>Vos déplacements, en toute simplicité</h2><p>Choisissez comment myridemate utilise votre position.</p></div>
    <button class="preference-row" data-action="toggle-gps"><span class="preference-copy"><strong>Détecter ma position</strong><small>Nous trouvons automatiquement votre pays, ville et région.</small></span><span class="toggle ${preferences.gps ? "on" : ""}"></span></button>
    <p class="eyebrow form-eyebrow">OU CHOISIR MANUELLEMENT</p>
    <label class="form-label">Pays<select id="country-select">${Object.keys(citiesByCountry).map((name) => `<option ${country === name ? "selected" : ""}>${escapeHTML(name)}</option>`).join("")}</select></label>
    <label class="form-label">Ville<select id="city-select">${cities.map((city) => `<option ${preferences.city === city ? "selected" : ""}>${escapeHTML(city)}</option>`).join("")}</select></label>
    <label class="form-label">Région<select id="region-select">${regions.map((region) => `<option ${preferences.region === region ? "selected" : ""}>${escapeHTML(region)}</option>`).join("")}</select></label>
    <button class="button button-primary full-width bottom-action" data-action="save-location">Enregistrer</button>
  </main>`;
}

function languagePage() {
  return `${header("Langues", { back: true })}<main class="content-page">${photoBanner("metro", "Une app à votre langue", "Choisissez la langue de myridemate")}<p class="page-description">Choisissez la langue de votre application.</p><div class="language-list">${availableLanguages.map(([flag, language]) => `<button class="language-row ${preferences.language === language ? "selected" : ""}" data-language="${language}"><span class="flag">${flag}</span><span>${language}</span>${preferences.language === language ? `<span class="language-check">✓</span>` : ""}</button>`).join("")}</div><p class="helper-text">La langue sera appliquée immédiatement.</p></main>`;
}

function appearancePage() {
  const themes = [
    ["light", "Mode clair", "light-preview"],
    ["dark", "Mode sombre", "dark-preview"],
    ["ocean", "Océan", "ocean-preview"],
    ["forest", "Forêt", "forest-preview"],
  ];
  return `${header("Apparence", { back: true })}<main class="content-page form-page">${photoBanner("skyline", "À votre image", "Choisissez un thème agréable pour vos trajets")}
    <p class="page-description">Choisissez le thème de votre application.</p>
    <div class="theme-options">${themes.map(([value, label, preview]) => `<button class="theme-option ${preferences.theme === value ? "selected" : ""}" data-theme-option="${value}"><span class="theme-preview ${preview}"><i></i><i></i><i></i></span><span>${label}</span><span class="radio"></span></button>`).join("")}</div>
    <div class="system-row"><span><strong>Suivre le système</strong><small>Adapter automatiquement l'apparence</small></span><button class="toggle ${preferences.followSystem ? "on" : ""}" data-action="toggle-system" aria-label="Suivre le système"></button></div>
    <div class="theme-note">${icon("moon")} Votre préférence est enregistrée sur cet appareil.</div>
  </main>`;
}

function emergencyPage() {
  return `${header("Alerte / Urgence", { back: true })}<main class="content-page emergency-page">${photoBanner("city", "Voyagez sereinement", "Les contacts d'urgence sont accessibles à tout moment")}<div class="sos-circle">SOS</div><h2>Besoin d'aide ?</h2><p>En cas d'urgence, maintenez le bouton SOS pendant 3 secondes.</p><button class="button button-danger sos-button" data-action="sos">Maintenir pour alerter</button>
    <button class="preference-row emergency-toggle" data-action="toggle-gps"><span class="preference-copy"><strong>Partager ma position</strong><small>Transmettre ma position à mes contacts d'urgence.</small></span><span class="toggle ${preferences.gps ? "on" : ""}"></span></button>
    <a class="emergency-number" href="tel:112"><span>${icon("phone")}</span><span><strong>Numéro d'urgence</strong><small>112 · Numéro européen</small></span>${icon("arrow")}</a>
    <button class="button button-soft full-width" data-action="emergency-options">Plus d'options</button>
  </main>`;
}

function offlinePage() {
  return `${header("Cartes hors ligne", { back: true })}<main class="content-page offline-page">${photoBanner("train", "Même sans réseau", "Préparez vos déplacements à l'avance")}
    <div class="offline-illustration"><div class="paper-map">${icon("pin", 45)}</div><span class="download-badge">${icon("download", 22)}</span></div><h2>Gardez votre carte à portée de main</h2><p>Téléchargez le plan de Paris pour retrouver les principaux arrêts même sans connexion.</p>
    <div class="download-info"><span>${icon("pin")} ${escapeHTML(preferences.city)} & environs</span><span>${icon("download")} 12 Mo</span><span class="download-status">${preferences.downloaded ? "Disponible hors ligne" : "À télécharger"}</span></div>
    <button class="button ${preferences.downloaded ? "button-soft" : "button-primary"} full-width" data-action="download-map">${preferences.downloaded ? icon("shield", 17) + " Carte téléchargée · Supprimer" : icon("download", 17) + " Télécharger la carte"}</button>
    <p class="helper-text offline-note">Les horaires en temps réel nécessitent une connexion internet.</p>
  </main>`;
}

function profilePage() {
  const activeTrip = currentDriverTrip();
  return `${header("Mon profil", { back: true })}<main class="content-page profile-page">${photoBanner("bus", "Votre espace mobilité", "Profil anonyme et trajets collectifs")}
    <div class="profile-heading"><span class="profile-avatar">${icon(preferences.role === "Conducteur" ? "car" : "user", 29)}</span><div><h2>${escapeHTML(preferences.name)}</h2><span class="role-badge">${escapeHTML(preferences.role)} · invité</span></div><button class="icon-button" data-action="edit-name" aria-label="Modifier le nom">${icon("settings", 18)}</button></div>
    ${preferences.role === "Conducteur" ? `<div class="driver-info-grid"><div><small>Véhicule</small><strong>${escapeHTML(activeTrip?.vehicle || driverVehicle)}</strong></div><div><small>Ligne</small><strong>${escapeHTML(activeTrip?.line || driverLine)}</strong></div>${preferences.driverCompany ? `<div><small>Compagnie</small><strong>${escapeHTML(preferences.driverCompany)}</strong></div>` : ""}<div><small>Disponibilité</small><strong class="availability"><i></i> ${activeTrip ? "En service" : "Disponible"}</strong></div></div>` : `<div class="passenger-profile-stats"><span><strong>12</strong><small>trajets</small></span><span><strong>4</strong><small>favoris</small></span><span><strong>${escapeHTML(preferences.city)}</strong><small>votre ville</small></span></div>`}
    <div class="settings-list profile-links"><button class="setting-row" data-page="trips"><span class="setting-icon">${icon("route", 18)}</span><span>Mes trajets</span>${icon("arrow", 16)}</button><button class="setting-row" data-action="history"><span class="setting-icon">${icon("clock", 18)}</span><span>Mon historique</span>${icon("arrow", 16)}</button><button class="setting-row" data-page="help"><span class="setting-icon">${icon("help", 18)}</span><span>Assistance</span>${icon("arrow", 16)}</button></div>
    <button class="button ${preferences.role === "Conducteur" ? "button-soft" : "button-primary"} full-width role-action" data-action="switch-driver">${preferences.role === "Conducteur" ? "Passer en mode passager" : "Passer en mode conducteur"} ${icon("arrow", 17)}</button>
    <button class="text-button signout-button" data-action="change-mode">Changer de mode</button>
  </main>`;
}

function helpPage() {
  return `${header("Aide & Support", { back: true })}<main class="content-page">${photoBanner("metro", "Besoin d'un coup de main ?", "Retrouvez les réponses à vos questions")}<div class="help-hero"><span>${icon("help", 32)}</span><h2>Comment pouvons-nous vous aider ?</h2><p>Retrouvez les réponses aux questions fréquentes.</p></div><div class="settings-list"><button class="setting-row" data-action="help-topic"><span>Comment planifier un trajet ?</span>${icon("arrow", 16)}</button><button class="setting-row" data-action="help-topic"><span>Gérer mes notifications</span>${icon("arrow", 16)}</button><button class="setting-row" data-action="help-topic"><span>Utiliser les cartes hors ligne</span>${icon("arrow", 16)}</button><button class="setting-row" data-action="contact"><span>Contacter le support</span>${icon("arrow", 16)}</button></div><a class="button button-soft full-width contact-link" href="mailto:support@myridemate.app">Envoyer un e-mail au support</a></main>`;
}

function privacyPage() {
  return `${header("Confidentialité", { back: true })}<main class="content-page form-page">${photoBanner("city", "Vos données vous appartiennent", "Gardez le contrôle de vos préférences")}<div class="illustration-bubble">${icon("shield", 34)}</div><div class="page-intro"><h2>Vos données restent les vôtres</h2><p>Vous gardez le contrôle sur les informations partagées avec myridemate.</p></div><div class="settings-list"><div class="setting-row static-row"><span>Position GPS</span><small>${preferences.gps ? "Activée" : "Désactivée"}</small></div><button class="setting-row" data-action="toggle-notifications"><span>Notifications personnalisées</span><span class="toggle ${preferences.notifications ? "on" : ""}"></span></button><button class="setting-row" data-action="export-data"><span>Exporter mes données</span>${icon("arrow", 16)}</button><button class="setting-row" data-action="delete-account"><span class="danger-text">Supprimer mon compte</span>${icon("arrow", 16)}</button></div></main>`;
}

function render() {
  destroyMaps();
  savePreferences();
  const pages = { home: homePage, favorites: favoritesPage, alerts: alertsPage, trips: tripsPage, tracking: trackingPage, "driver-setup": driverSetupPage, notifications: notificationsPage, route: routePage, itinerary: itineraryPage, schedules: schedulesPage, settings: settingsPage, location: locationPage, language: languagePage, appearance: appearancePage, emergency: emergencyPage, offline: offlinePage, profile: profilePage, help: helpPage, privacy: privacyPage, welcome: welcomePage, account: accountPage };
  app.innerHTML = `<div class="app-shell ${currentPage === "home" ? "map-shell" : ""} ${currentPage === "full-map" ? "fullscreen-map-shell" : ""}">${(currentPage === "full-map" ? fullMapPage : pages[currentPage] || homePage)()}</div>${bottomNav()}`;
  applyTranslations();
  app.querySelector(".app-shell").scrollTop = 0;
  initializeVisibleMaps();
}

const pageHistory = [];
function navigate(page) {
  if (page === "account") activeTab = "";
  else if (page === "driver-setup") activeTab = "trips";
  else if (["home", "favorites", "alerts", "trips", "settings", "notifications"].includes(page)) activeTab = page;
  if (page === "itinerary") currentQuery = "";
  if (currentPage !== page) pageHistory.push(currentPage);
  currentPage = page;
  render();
}

function goBack() {
  currentPage = pageHistory.pop() || "home";
  render();
}

function doPlanRoute() {
  const field = document.querySelector("#itinerary-destination");
  if (field && field.value.trim()) currentQuery = field.value.trim();
  if (!currentQuery) {
    showToast("Saisissez une destination pour rechercher un itinéraire.");
    document.querySelector("#itinerary-destination")?.focus();
    return;
  }
  selectedRoute = featuredByMode[selectedMode] || "Bus 87";
  navigate("route");
}

app.addEventListener("click", async (event) => {
  const target = event.target.closest("button, [data-page]");
  if (!target) return;
  if (target.dataset.page) { navigate(target.dataset.page); return; }
  if (target.dataset.tab) { navigate(target.dataset.tab); return; }
  if (target.dataset.mode) {
    selectedMode = target.dataset.mode;
    selectedRoute = featuredByMode[selectedMode] || selectedRoute;
    if (scheduleOptions[selectedMode] && !scheduleOptions[selectedMode].includes(selectedScheduleLine)) selectedScheduleLine = scheduleOptions[selectedMode][0];
    render();
    return;
  }
  if (target.dataset.language) { preferences.language = target.dataset.language; render(); showToast(`${translateText("Langue")}: ${target.dataset.language}`); return; }
  if (target.dataset.themeOption) {
    preferences.theme = target.dataset.themeOption;
    preferences.dark = preferences.theme === "dark";
    preferences.followSystem = false;
    render();
    return;
  }
  switch (target.dataset.action) {
    case "back": goBack(); break;
    case "plan-route": doPlanRoute(); break;
    case "show-route": selectedRoute = target.dataset.line || "Bus 87"; navigate("route"); break;
    case "show-map": navigate("home"); break;
    case "new-route": navigate("itinerary"); break;
    case "locate": {
      const map = mapInstances["home-osm-map"] || mapInstances["fullscreen-osm-map"] || mapInstances["route-osm-map"];
      if (!preferences.gps) showToast("Activez la localisation dans les paramètres.");
      else if (map && navigator.geolocation) map.locate({ setView: true, maxZoom: 16 });
      else showToast(`Position simulée : ${preferences.city}.`);
      break;
    }
    case "enter-full-map": navigate("full-map"); break;
    case "exit-full-map": goBack(); break;
    case "favorite": {
      const line = selectedRoute;
      const favorites = preferences.favoriteRoutes || [];
      preferences.favoriteRoutes = favorites.includes(line) ? favorites.filter((item) => item !== line) : [...favorites, line];
      render();
      showToast(preferences.favoriteRoutes.includes(line) ? "Ajouté à vos favoris." : "Retiré de vos favoris.");
      break;
    }
    case "share-route":
      if (navigator.share) {
        try { await navigator.share({ title: "Mon trajet myridemate", text: `${selectedRoute} · Gare de Lyon → Châtelet` }); }
        catch (error) { if (error.name !== "AbortError") { console.error("Le partage a échoué.", error); showToast("Impossible de partager le trajet."); } }
      } else if (navigator.clipboard) {
        try { await navigator.clipboard.writeText(`${selectedRoute} · Gare de Lyon → Châtelet`); showToast("Détails du trajet copiés."); }
        catch (error) { console.error("La copie a échoué.", error); showToast("Impossible de copier les détails du trajet."); }
      } else showToast("Le partage n'est pas disponible sur cet appareil.");
      break;
    case "search-schedules": showToast(`${selectedScheduleLine} · horaires simulés pour ${preferences.city}.`); break;
    case "toggle-gps": preferences.gps = !preferences.gps; render(); break;
    case "save-location": {
      preferences.country = document.querySelector("#country-select")?.value || preferences.country;
      preferences.city = document.querySelector("#city-select")?.value || preferences.city;
      preferences.region = document.querySelector("#region-select")?.value || regionsByCity[preferences.city] || preferences.region;
      render(); showToast(`Localisation définie sur ${preferences.city}.`); break;
    }
    case "toggle-notifications": preferences.notifications = !preferences.notifications; render(); break;
    case "toggle-vibration": preferences.vibrationEnabled = !preferences.vibrationEnabled; render(); break;
    case "preview-sound": playNotificationSound(document.querySelector("#notification-sound")?.value); break;
    case "request-push":
      try { await requestPushNotifications(); }
      catch (error) { console.error("L'activation des notifications a échoué.", error); showToast("Impossible d'activer les notifications sur cet appareil."); }
      break;
    case "toggle-system": preferences.followSystem = !preferences.followSystem; render(); break;
    case "download-map":
      preferences.downloaded = !preferences.downloaded;
      render();
      showToast(preferences.downloaded ? `Carte de ${preferences.city} disponible hors ligne.` : "Carte hors ligne supprimée.");
      break;
    case "switch-driver":
      if (preferences.role === "Conducteur" && currentDriverTrip()) {
        showToast("Terminez d'abord le trajet en cours avant de changer de mode.");
        break;
      }
      preferences.role = preferences.role === "Passager" ? "Conducteur" : "Passager";
      if (preferences.role === "Conducteur") {
        navigate(preferences.driverSetupComplete ? "trips" : "driver-setup");
        showToast(preferences.driverSetupComplete ? "Mode conducteur activé." : "Configurez votre véhicule avant de commencer.");
      } else { navigate("profile"); showToast("Mode passager activé."); }
      break;
    case "choose-passenger":
      preferences.role = "Passager"; navigate("home"); showToast("Bienvenue dans myridemate.");
      break;
    case "choose-driver":
      preferences.role = "Conducteur";
      navigate(preferences.driverSetupComplete ? "trips" : "driver-setup");
      showToast(preferences.driverSetupComplete ? "Mode conducteur activé." : "Configurez votre véhicule avant de commencer.");
      break;
    case "continue-guest": navigate("home"); showToast("Bienvenue dans myridemate."); break;
    case "start-trip": startDriverTrip(); break;
    case "save-driver-setup":
      if (persistDriverSetup()) {
        driverFormOpen = false;
        navigate("trips");
        showToast("Configuration conducteur enregistrée.");
      }
      break;
    case "save-driver-route": saveDriverRoute(); break;
    case "clear-driver-photo": {
      driverPhoto = "";
      preferences.driverPhoto = "";
      savePreferences();
      updateDriverPhotoPreview();
      const photoInput = document.querySelector("#driver-photo-input");
      if (photoInput) photoInput.value = "";
      showToast("Photo du transport supprimée.");
      break;
    }
    case "new-driver-route": driverFormOpen = true; render(); break;
    case "start-auto-trip":
      if (preferences.savedDriverRoutes?.length) startDriverTrip(preferences.savedDriverRoutes[0]);
      else startDriverTrip();
      break;
    case "start-saved-route": {
      const savedRoute = preferences.savedDriverRoutes.find((route) => route.id === target.dataset.routeId);
      if (savedRoute) startDriverTrip(savedRoute);
      else showToast("Ce trajet enregistré est introuvable.");
      break;
    }
    case "wait-for-trip": {
      const trip = activeTrips().find((item) => item.id === target.dataset.tripId);
      if (!trip) {
        showToast("Ce trajet n'est plus actif.");
        break;
      }
      if (!Number.isFinite(Number(trip.waitingPassengers))) trip.waitingPassengers = 0;
      if (isWaitingForTrip(trip)) {
        preferences.waitingTripIds = preferences.waitingTripIds.filter((id) => id !== trip.id);
        trip.waitingPassengers = Math.max(0, trip.waitingPassengers - 1);
      } else {
        preferences.waitingTripIds.push(trip.id);
        trip.waitingPassengers += 1;
      }
      savePreferences();
      saveLiveTrips();
      updateTrackingValues(trip);
      render();
      break;
    }
    case "end-trip": endDriverTrip(); break;
    case "progress-trip": progressActiveTrip(); break;
    case "follow-trip":
    case "show-tracking":
      preferences.followedTripId = target.dataset.tripId || "";
      navigate("tracking");
      break;
    case "stop-follow":
      preferences.followedTripId = "";
      navigate("trips");
      break;
    case "refresh-trips": render(); showToast("Liste des trajets actualisée."); break;
    case "sos": break;
    case "emergency-options": showToast("Appelez le 112 en cas de danger immédiat."); break;
    case "install":
      if (window.deferredInstallPrompt) {
        window.deferredInstallPrompt.prompt();
        window.deferredInstallPrompt = null;
      } else showToast("Pour installer l'application, utilisez « Ajouter à l'écran d'accueil » dans votre navigateur.");
      break;
    case "edit-name": {
      const newName = prompt("Votre nom", preferences.name);
      if (newName?.trim()) { preferences.name = newName.trim(); preferences.profileNameCustomized = true; render(); showToast("Votre profil a été mis à jour."); }
      break;
    }
    case "signout": navigate("welcome"); break;
    case "change-mode": navigate("account"); break;
    case "history": navigate("trips"); break;
    case "export-data":
      try {
        const blob = new Blob([JSON.stringify(preferences, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = "myridemate-donnees.json"; link.click();
        URL.revokeObjectURL(url);
        showToast("Export de vos préférences téléchargé.");
      } catch (error) { console.error("L'export des données a échoué.", error); showToast("Impossible d'exporter vos données."); }
      break;
    case "delete-account": showToast("Pour supprimer votre compte, contactez support@myridemate.app."); break;
    case "contact": window.location.href = "mailto:support@myridemate.app"; break;
    case "help-topic": showToast("Cette rubrique sera bientôt disponible."); break;
    case "alert-filter": alertFilter = target.dataset.filter || "Toutes"; render(); break;
    case "open-alert": showToast("Aucune alerte urgente pour le moment."); break;
  }
});

app.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.id === "destination-search") {
    currentQuery = event.target.value.trim();
    render();
    if (!currentQuery) document.querySelector("#destination-search")?.focus();
  }
  if (event.key === "Enter" && event.target.id === "itinerary-destination") doPlanRoute();
});

app.addEventListener("input", (event) => {
  if (event.target.id === "destination-search") currentQuery = event.target.value;
  if (event.target.id === "notification-volume") {
    preferences.notificationVolume = Number(event.target.value);
    const value = document.querySelector("#volume-value");
    if (value) value.textContent = `${preferences.notificationVolume}%`;
    savePreferences();
  }
});

app.addEventListener("change", async (event) => {
  const field = event.target;
  if (field.id === "driver-photo-input") {
    const file = field.files?.[0];
    if (!file) return;
    try {
      driverPhoto = await encodeDriverPhoto(file);
      updateDriverPhotoPreview();
      showToast("Photo ajoutée. Enregistrez la configuration pour la conserver.");
    } catch (error) {
      console.error("Impossible de charger la photo du transport.", error);
      showToast(error.message || "Impossible de charger la photo du transport.");
      field.value = "";
    }
  } else if (field.id === "header-language") {
    preferences.language = field.value;
    render();
    showToast(`${translateText("Langue")}: ${field.value}`);
  } else if (field.id === "country-select") {
    preferences.country = field.value;
    preferences.city = citiesByCountry[field.value][0];
    preferences.region = regionsByCity[preferences.city];
    render();
  } else if (field.id === "city-select") {
    preferences.city = field.value;
    preferences.region = regionsByCity[field.value];
    render();
  } else if (field.id === "region-select") {
    preferences.region = field.value;
  } else if (field.id === "schedule-city") {
    preferences.city = field.value;
    preferences.country = Object.keys(citiesByCountry).find((country) => citiesByCountry[country].includes(field.value)) || preferences.country;
    preferences.region = regionsByCity[field.value] || preferences.region;
    render();
  } else if (field.id === "schedule-line") {
    selectedScheduleLine = field.value;
    showToast(`Ligne ${selectedScheduleLine} sélectionnée.`);
  } else if (field.id === "driver-mode") {
    driverMode = field.value;
    driverLine = scheduleOptions[driverMode][0];
    const stops = preferences.city === "Paris"
      ? scheduleStopsByMode[driverMode] || scheduleStopsByMode.Bus
      : [`Centre de ${preferences.city}`, "Gare principale", "Station centrale"];
    driverOrigin = stops[0];
    driverDestination = stops[1] || stops[0];
    selectedMode = driverMode;
    selectedRoute = featuredByMode[driverMode] || selectedRoute;
    render();
  } else if (field.id === "driver-line") {
    driverLine = field.value;
  } else if (field.id === "driver-origin") {
    driverOrigin = field.value;
  } else if (field.id === "driver-destination") {
    driverDestination = field.value;
  } else if (field.id === "driver-vehicle") {
    driverVehicle = field.value.trim();
  } else if (field.id === "notification-sound") {
    preferences.notificationSound = field.value;
    savePreferences();
  } else if (field.id === "vibration-intensity") {
    preferences.vibrationIntensity = field.value;
    savePreferences();
  } else if (field.id === "approach-time") {
    preferences.approachTimeMinutes = Number(field.value);
    savePreferences();
  } else if (field.id === "approach-distance") {
    preferences.approachDistanceKm = Number(field.value);
    savePreferences();
  }
});

let sosHoldTimer;
let sosHoldCompleted = false;
app.addEventListener("pointerdown", (event) => {
  const button = event.target.closest(".sos-button");
  if (!button) return;
  sosHoldCompleted = false;
  button.setPointerCapture(event.pointerId);
  sosHoldTimer = setTimeout(() => {
    sosHoldCompleted = true;
    if (window.confirm("Appeler les services d'urgence au 112 ?")) window.location.href = "tel:112";
    else showToast("Appel d'urgence annulé.");
  }, 3000);
});
app.addEventListener("pointerup", (event) => {
  if (!event.target.closest(".sos-button")) return;
  clearTimeout(sosHoldTimer);
  if (!sosHoldCompleted) showToast("Maintenez le bouton SOS pendant 3 secondes.");
});
app.addEventListener("pointercancel", () => clearTimeout(sosHoldTimer));

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.deferredInstallPrompt = event;
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => console.error("Échec de l'enregistrement du mode hors ligne.", error));
  });
}

render();
