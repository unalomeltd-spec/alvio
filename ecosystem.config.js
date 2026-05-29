module.exports = {
  apps: [{
    name: 'alvio',
    script: 'node_modules/.bin/next',
    args: 'start -p 3001',
    cwd: '/var/www/alvio',
    env: { NODE_ENV: 'production' }
  }]
}
