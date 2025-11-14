module.exports = {
  apps: [
    {
      name: "api_sequelize",
      script: "src/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      interpreter: "node",
      node_args: "-r dotenv/config", // esto carga dotenv
      env: {
        NODE_ENV: "production",
        PORT: 3500,
        DOTENV_CONFIG_PATH: ".env.production" // indica el archivo a usar
      }
    }
  ]
};
