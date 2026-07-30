const { DataTypes } = require("sequelize"); 
const sequelize = require("../config/database");
const CardDetails = sequelize.define
("CardDetails", 
    
    { 
    id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true

     }, 

    card_number: {
         type: DataTypes.STRING, 
         allowNull: false, 
         unique: true
         }, 

    card_holder_name:
     { type: DataTypes.STRING,
         allowNull: false 
        }, 
    expiry_date: { type: DataTypes.DATE, allowNull: false }, 
    cvv: { type: DataTypes.STRING, allowNull: false }, 
    billing_address: { type: DataTypes.STRING, allowNull: false }



},
     { tableName: "card_details", underscored: true, timestamps: true }); CardDetails.associate = () => {}; module.exports = CardDetails;
