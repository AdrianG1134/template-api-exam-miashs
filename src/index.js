import 'dotenv/config'
import Fastify from 'fastify'
import { submitForReview } from './submission.js'

const fastify = Fastify({
  logger: true,
})

fastify.listen(
  {
    port: process.env.PORT || 3000,
    host: process.env.RENDER_EXTERNAL_URL ? '0.0.0.0' : process.env.HOST || 'localhost',
  },
  function (err) {
    if (err) {
      fastify.log.error(err)
      process.exit(1)
    }

    //////////////////////////////////////////////////////////////////////
    // Don't delete this line, it is used to submit your API for review //
    // everytime your start your server.                                //
    //////////////////////////////////////////////////////////////////////
    submitForReview(fastify)
  }
)

const headers = {
  accept: 'application/json',
  'content-type': 'application/json',
  Authorization: `Bearer ${process.env.API_KEY}`,
};
const apiKey = process.env.API_KEY

// Fonction pour récupérer l'ID d'un film
const getCityInfo = async (query) => {
  const url = `https://api-ugi2pflmha-ew.a.run.app/cities/${encodeURIComponent(query)}/insights?apiKey=${apiKey}`;
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Erreur lors de la recherche de la ville : ${response.statusText}`);
    }
    const json = await response.json();
    if (json.results && json.results.length > 0) {
      return json.results[0].id; // Retourne l'ID de la première ville trouvée
    }
    throw new Error('Aucun résultat trouvé pour la ville demandée.');
  } catch (err) {
    console.error(err.message);
    throw err;
  }
};


// Route GET /cities/:cityId/infos
fastify.get('/cities/:cityId/infos', async (request, reply) => {
  const { cityId } = request.params

  try {
    // Récupérer les infos de la ville depuis City API
    const cityResponse = await fetch(
      `${CITY_API_BASE_URL}/cities/${cityId}?apiKey=${apiKey}`,
      { method: 'GET', headers }
    )
    if (!cityResponse.ok) {
      if (cityResponse.status === 404) {
        return reply.code(404).send({ error: 'Ville non trouvée' })
      }
      throw new Error(`Erreur lors de la récupération de la ville : ${cityResponse.statusText}`)
    }
    const cityData = await cityResponse.json()

    // Récupérer les prévisions météo depuis Weather API
    const weatherResponse = await fetch(
      `${"https://api-ugi2pflmha-ew.a.run.app/weather-predictions"}/cities/${cityId}/weather?apiKey=${apiKey}`,
      { method: 'GET', headers }
    )
    if (!weatherResponse.ok) {
      throw new Error(`Erreur lors de la récupération des prévisions météo : ${weatherResponse.statusText}`)
    }
    const weatherData = await weatherResponse.json()

    // Transformation des données météo en 2 prédictions : "today" et "tomorrow"
    const weatherPredictions = [
      {
        when: 'today',
        min: weatherData.today.min,
        max: weatherData.today.max,
      },
      {
        when: 'tomorrow',
        min: weatherData.tomorrow.min,
        max: weatherData.tomorrow.max,
      }
    ]

    // Construction de la réponse au format attendu
    const result = {
      coordinates: cityData.coordinates, // [lat, lon]
      population: cityData.population,
      knownFor: cityData.knownFor, // Tableau de chaînes de caractères
      weatherPredictions,
      recipes: [] // Tableau vide, ou à remplacer par des données réelles si disponible
    }

    reply.send(result)
  } catch (error) {
    fastify.log.error(error.message)
    reply.code(500).send({ error: 'Erreur serveur' })
  }
})

fastify.get("cities/:cityId/infos", getCityInfo);