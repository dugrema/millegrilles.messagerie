const debug = require('debug')('messagerie:poster')
const express = require('express')

function route() {
    const route = express.Router()
    route.get('/poster', poster)
    return route
}

function poster(req, res) {
    debug(req.headers)
    const idmg = req.idmg
    const host = req.headers.host

    const reponse = {hostname: host, idmg}
    return res.send(reponse)
}

module.exports = route
