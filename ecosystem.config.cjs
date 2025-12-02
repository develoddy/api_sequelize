module.exports = {
  apps: [
    {
      name: 'api_sequelize',
      script: './src/index.js',
      env: {
        NODE_ENV: 'development',
        PORT: 3500
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3500
      },
    },
  ],
};



// module.exports = {
//   apps: [
//     {
//       name: "api_sequelize",
//       script: "src/index.js",
//       instances: 1,
//       autorestart: true,
//       watch: false,
//       max_memory_restart: "300M",
//       env: {
//         NODE_ENV: "production",
//         PORT: 3500
//       }
//     }
//   ]
// };
