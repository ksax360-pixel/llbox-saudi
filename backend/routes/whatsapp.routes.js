const express = require('express');
const whatsappController = require('../controllers/whatsapp.controller');

const router = express.Router();

router.get('/contacts', whatsappController.listContacts);
router.get('/contacts/:phone', whatsappController.lookupContact);
router.post('/contacts/lookup', whatsappController.lookupContact);
router.post('/contacts', whatsappController.upsertContact);

module.exports = router;
