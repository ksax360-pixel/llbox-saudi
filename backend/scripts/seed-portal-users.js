require('dotenv').config();

const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const User = require('../models/User');
const { ROLES } = require('../utils/constants');

const portalUsers = [
  { name: 'Ahmed Al-Rashid', email: 'admin@llbox.com', password: 'admin123', role: ROLES.ADMIN, mobile: '+919606742371' },
  { name: 'Junai', email: 'ksa.x360@gmail.com', password: 'KsaX360@Junai', role: ROLES.ADMIN, mobile: '+919900094442' },
  { name: 'Sara Al-Farsi', email: 'ops@llbox.com', password: 'ops123', role: ROLES.OPERATOR, mobile: '+966500000001' },
  { name: 'Omar Hassan', email: 'support@llbox.com', password: 'support123', role: ROLES.VIEWER, mobile: '+966511122233' },
  { name: 'Khalid Al-Otaibi', email: 'customer@llbox.com', password: 'customer123', role: ROLES.VIEWER, mobile: '+966500000002' },
];

(async () => {
  await connectDatabase();
  for (const user of portalUsers) {
    const existing = await User.findOne({ email: user.email });
    if (existing) {
      let changed = false;
      if (user.mobile && existing.mobile !== user.mobile) {
        existing.mobile = user.mobile;
        changed = true;
      }
      if (user.role && existing.role !== user.role) {
        existing.role = user.role;
        changed = true;
      }
      if (user.name && existing.name !== user.name) {
        existing.name = user.name;
        changed = true;
      }
      if (changed) {
        await existing.save({ validateBeforeSave: false });
        console.log(`updated: ${user.email}`);
      } else {
        console.log(`exists: ${user.email}`);
      }
      continue;
    }
    await User.create(user);
    console.log(`created: ${user.email}`);
  }
  await mongoose.connection.close();
  process.exit(0);
})().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
