const { createMemoryRepository } = require("./memory");

const repository = createMemoryRepository();

module.exports = { repository, createMemoryRepository };