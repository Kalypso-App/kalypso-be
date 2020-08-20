const Campaign = require('../Campaign');

class CampaignRepository {
    constructor(model) {
        this.model = model;
    }

    create(object) {
        return this.model.create(object);
    }
}

module.exports = new CampaignRepository(Campaign);