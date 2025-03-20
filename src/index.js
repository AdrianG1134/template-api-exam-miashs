import 'dotenv/config'
import Fastify from 'fastify'
import { submitForReview } from './submission.js'

const fastify = Fastify({ logger: true })

const apiKey = process.env.API_KEY
const BASE_URL = 'https://api-ugi2pflmha-ew.a.run.app'
const headers = {
  accept: 'application/json',
  'content-type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
}

// Fonction pour récupérer les informations de la ville (insights)
const getCityInfo = async (cityId) => { 
  const url = `${BASE_URL}/cities/${encodeURIComponent(cityId)}/insights?apiKey=${apiKey}`;
  try {
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération de la ville : ${response.statusText}`);
    }
    // On s'attend à ce que l'endpoint retourne directement l'objet au format attendu
    const json = await response.json();
    return json;
  } catch (err) {
    console.error(err.message);
    throw err;
  }
};

// Fonction pour récupérer les prévisions météo
const getWeatherPredictions = async (cityId) => {
  const url = `${BASE_URL}/weather-predictions?cityId=${cityId}&apiKey=${apiKey}`;
  try {
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération des prévisions météo : ${response.statusText}`);
    }
    const json = await response.json();
    // Transformation au format attendu : tableau de 2 objets (today et tomorrow)
    return [
      { when: 'today', min: json.today.min, max: json.today.max },
      { when: 'tomorrow', min: json.tomorrow.min, max: json.tomorrow.max }
    ];
  } catch (err) {
    console.error(err.message);
    throw err;
  }
};

// Route GET /cities/:cityId/infos
fastify.get('/cities/:cityId/infos', async (request, reply) => {
  const { cityId } = request.params;
  try {
    // Récupérer les informations de la ville
    const cityInfo = await getCityInfo(cityId);
    if (!cityInfo || !cityInfo.coordinates) {
      return reply.code(404).send({ error: 'Ville non trouvée' });
    }
    // Récupérer les prévisions météo
    const weatherPredictions = await getWeatherPredictions(cityId);
    // Assemblage de la réponse
    const result = {
      coordinates: cityInfo.coordinates,  // [latitude, longitude]
      population: cityInfo.population,
      knownFor: cityInfo.knownFor,          // Tableau de chaînes de caractères
      weatherPredictions,                   // Prévisions météo transformées
      recipes: cityInfo.recipes || []       // Tableau de recettes (ou tableau vide)
    };
    reply.send(result);
  } catch (err) {
    // En cas d'erreur liée à la récupération de la ville, renvoyer 404
    if (err.message.includes('Erreur lors de la récupération de la ville')) {
      return reply.code(404).send({ error: 'Ville non trouvée' });
    }
    reply.code(500).send({ error: 'Erreur serveur' });
  }
});

fastify.listen(
  {
    port: process.env.PORT || 3000,
    host: process.env.RENDER_EXTERNAL_URL ? '0.0.0.0' : process.env.HOST || 'localhost',
  },
  (err) => {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    // Soumission de l'API pour revue
    submitForReview(fastify);
  }
);
