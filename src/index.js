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

// Variables globales pour le stockage des recettes
const recipesStore = {}  // structure : { [cityId]: [ { id, content }, ... ] }
let nextRecipeId = 1

// Fonction pour récupérer l'ID d'une ville à partir de son nom
const getCityId = async (cityName) => {
  const url = `${BASE_URL}/cities?search=${encodeURIComponent(cityName)}&apiKey=${apiKey}`
  try {
    const response = await fetch(url, { method: 'GET', headers })
    if (!response.ok) {
      throw new Error(`Erreur lors de la recherche de la ville : ${response.statusText}`)
    }
    const json = await response.json()
    if (Array.isArray(json) && json.length > 0) {
      return json[0].id // Retourne l'ID du premier résultat trouvé
    }
    throw new Error('Aucun résultat trouvé pour la ville demandée.')
  } catch (err) {
    console.error(err.message)
    throw err
  }
}

// Fonction pour récupérer les informations de la ville (insights) à partir de son ID
const getCityInfo = async (cityId) => {
  const url = `${BASE_URL}/cities/${encodeURIComponent(cityId)}/insights?apiKey=${apiKey}`
  try {
    const response = await fetch(url, { method: 'GET', headers })
    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération de la ville : ${response.statusText}`)
    }
    const json = await response.json()
    return json
  } catch (err) {
    console.error(err.message)
    throw err
  }
}

// Fonction combinée pour récupérer les insights d'une ville à partir de son nom
const getCityInfoByName = async (cityName) => {
  const cityId = await getCityId(cityName)
  return await getCityInfo(cityId)
}

// Fonction pour récupérer les prévisions météo
const getWeatherPredictions = async (cityId) => {
  const url = `${BASE_URL}/weather-predictions?cityId=${cityId}&apiKey=${apiKey}`
  try {
    const response = await fetch(url, { method: 'GET', headers })
    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération des prévisions météo : ${response.statusText}`)
    }
    const json = await response.json()
    return [
      { when: 'today', min: json.today.min, max: json.today.max },
      { when: 'tomorrow', min: json.tomorrow.min, max: json.tomorrow.max }
    ]
  } catch (err) {
    console.error(err.message)
    throw err
  }
}

// Route GET /cities/:cityId/infos
fastify.get('/cities/:cityId/infos', async (request, reply) => {
  const { cityId } = request.params
  try {
    const cityInfo = await getCityInfo(cityId)
    if (!cityInfo || !cityInfo.id) {
      return reply.code(404).send({ error: 'Ville non trouvée' })
    }
    
    const weatherPredictions = await getWeatherPredictions(cityId)
    
    // Transformation : on renvoie un tableau contenant un objet au format attendu
    const result = [
      {
        cityId: cityInfo.id,
        cityName: cityInfo.name,
        predictions: weatherPredictions
      }
    ]
    
    reply.send(result)
  } catch (err) {
    if (err.message.includes('Aucun résultat')) {
      return reply.code(404).send({ error: 'Ville non trouvée' })
    }
    reply.code(500).send({ error: 'Erreur serveur' })
  }
})

// Route POST /cities/:cityId/recipes
fastify.post('/cities/:cityId/recipes', async (request, reply) => {
  const { cityId } = request.params
  const { content } = request.body || {}

  // Vérifier l'existence de la ville
  try {
    await getCityInfo(cityId)
  } catch (err) {
    return reply.code(404).send({ error: 'Ville non trouvée' })
  }

  // Validation du contenu de la recette
  if (typeof content !== 'string' || content.trim().length === 0) {
    return reply.code(400).send({ error: 'Le contenu de la recette est requis' })
  }
  if (content.trim().length < 10) {
    return reply.code(400).send({ error: 'Le contenu est trop court (minimum 10 caractères)' })
  }
  if (content.trim().length > 2000) {
    return reply.code(400).send({ error: 'Le contenu est trop long (maximum 2000 caractères)' })
  }

  // Création et stockage de la recette
  const recipe = {
    id: nextRecipeId++,
    content: content.trim(),
  }

  if (!recipesStore[cityId]) {
    recipesStore[cityId] = []
  }
  recipesStore[cityId].push(recipe)

  reply.code(201).send(recipe)
})

// Route DELETE /cities/:cityId/recipes/:recipeId
fastify.delete('/cities/:cityId/recipes/:recipeId', async (request, reply) => {
  const { cityId, recipeId } = request.params;

  try {
    // Vérifier que la ville existe via l'API City
    await getCityInfo(cityId);
  } catch (err) {
    // Si la ville n'existe pas
    return reply.code(404).send({ error: 'Ville non trouvée' });
  }

  // Vérifier si des recettes existent pour cette ville
  const recipes = recipesStore[cityId];
  if (!recipes || recipes.length === 0) {
    return reply.code(404).send({ error: 'Recette non trouvée' });
  }

  // Convertir recipeId en entier (si nécessaire) ou utiliser la comparaison de chaînes
  const recipeIndex = recipes.findIndex(r => String(r.id) === recipeId);
  if (recipeIndex === -1) {
    return reply.code(404).send({ error: 'Recette non trouvée' });
  }

  // Supprimer la recette du tableau
  recipes.splice(recipeIndex, 1);

  // Répondre avec "no content" (204)
  reply.code(204).send();
});


// Démarrage du serveur Fastify
fastify.listen(
  {
    port: process.env.PORT || 3000,
    host: process.env.RENDER_EXTERNAL_URL ? '0.0.0.0' : process.env.HOST || 'localhost',
  },
  (err) => {
    if (err) {
      fastify.log.error(err)
      process.exit(1)
    }
    submitForReview(fastify)
  }
)
