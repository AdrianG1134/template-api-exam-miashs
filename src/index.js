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

fastify.get('/cities/:cityId/infos', async (request, reply) => {
  const { cityId } = request.params;
  try {
    const cityInfo = await getCityInfo(cityId);
    if (!cityInfo || !cityInfo.id) {
      return reply.code(404).send({ error: 'Ville non trouvée' });
    }
    
    const weatherPredictions = await getWeatherPredictions(cityId);
    
    // Transformation pour correspondre au modèle attendu
    const result = [
      {
        cityId: cityInfo.id,        // Extrait de votre City API
        cityName: cityInfo.name,    // Extrait de votre City API
        predictions: weatherPredictions  // Doit être un tableau d'objets { when, min, max }
      }
    ];
    
    reply.send(result);
  } catch (err) {
    if (err.message.includes('Aucun résultat')) {
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

export const recipes = async (request, reply) => {
  try {
    const { movieId, title } = request.body;
    if (title) {
      const movies = await searchMovies(title);
      if (movies.length === 0) {
        reply.status(404).send({ error: "Movie not found" });
      }
      const response = await updateMovieFromWatchlist(movies[0].id);
      reply.send(response);
    } else {
      try {
        const response = await updateMovieFromWatchlist(movieId);
        reply.send(response);
      } catch (error) {
        if (error.response?.status === 404) {
          reply.status(404).send({ error: "Movie not found" });
        } else {
          reply.status(500).send({ error: error.message });
        }
      }
    }
  } catch (error) {
    reply.status(500).send({ error: error.message });
  }
};