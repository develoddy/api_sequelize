module.exports = {
  apps: [
    {
      name: "api_sequelize",
      script: "./src/index.js",
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
