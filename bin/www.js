#!/usr/bin/env node

const debug = require('debug')('www')
const app = require('../src/app.js')

// const debug = debugLib('www')
debug("Demarrer server6")

// Initialiser le serveur
app()
    .catch(err=>{
        console.error("serveur6.www Erreur execution app : %O", err)
        process.exit()
    })
    .finally(()=>{
        debug("Fin initialisation serveur6.www")
    })
