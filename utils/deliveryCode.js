const CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateDeliveryCode = () => {
  let code = "";

  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(
      Math.random() * CHARACTERS.length
    );

    code += CHARACTERS[randomIndex];
  }

  return code;
};

module.exports = {
  generateDeliveryCode,
};