const dotenv = require('dotenv');
dotenv.config();

const { server } = require('./server');

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`VIMM Chat server running on port ${PORT}`);
  console.log(`Chat available at http://localhost:${PORT}/chat/:hiveAccount`);
});