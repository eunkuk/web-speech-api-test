const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  AUDIO_DIR: path.join(__dirname, '..', 'data', 'audio')
};
