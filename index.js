require('dotenv').config();

const express = require('express');
const { loadConfig } = require('./server/config');
const { createApp } = require('./server/app');

module.exports = createApp(loadConfig(), express());
