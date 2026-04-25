import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Phone, MessageCircle, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { sendWhatsAppMessage, formatPhoneNumber } from "../utils/whatsappUtils";

export default function ContactsPage({ user, setCurrentPage }) {
  const [contacts, setContacts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    relationship: "",
    notify: true,
  });

  useEffect(() => {
    const savedContacts = localStorage.getItem(`raneev-contacts-${user?.email}`);
    if (savedContacts) {
      setContacts(JSON.parse(savedContacts));
    }
  }, [user]);

  const handleAddContact = () => {
    if (!formData.name || !formData.phone || !formData.relationship) {
      toast.error("Please fill in all fields");
      return;
    }

    const newContact = {
      id: Date.now(),
      ...formData,
      phone: formatPhoneNumber(formData.phone),
    };

    const updatedContacts = [...contacts, newContact];
    setContacts(updatedContacts);
    localStorage.setItem(`raneev-contacts-${user?.email}`, JSON.stringify(updatedContacts));
    toast.success("Contact added successfully!");
    setFormData({ name: "", phone: "", relationship: "", notify: true });
    setShowForm(false);
  };

  const handleDeleteContact = (id) => {
    const updatedContacts = contacts.filter((c) => c.id !== id);
    setContacts(updatedContacts);
    localStorage.setItem(`raneev-contacts-${user?.email}`, JSON.stringify(updatedContacts));
    toast.success("Contact removed");
  };

  const handleSendAlert = (contact) => {
    const message = `🚨 EMERGENCY ALERT 🚨\nI need immediate help! Please call or come to my location. This is an urgent message from RANEEV Emergency System.`;
    sendWhatsAppMessage(contact.phone, message);
    toast.success(`Alert sent to ${contact.name} via WhatsApp!`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-b-3xl shadow-lg flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentPage("home")} className="hover:bg-white/20 p-2 rounded-lg">
            <ArrowLeft size={28} />
          </button>
          <h1 className="text-3xl font-bold">ICE Contacts</h1>
        </div>
        <p className="text-2xl font-bold text-yellow-300">{contacts.length}</p>
      </motion.div>

      {/* Add Contact Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowForm(!showForm)}
        className="m-6 w-[calc(100%-48px)] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2"
      >
        <Plus size={24} />
        Add New Contact
      </motion.button>

      {/* Contact Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white mx-6 p-6 rounded-2xl shadow-lg border-2 border-blue-200 mb-6"
        >
          <input
            type="text"
            placeholder="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-3 mb-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none text-base"
          />
          <input
            type="tel"
            placeholder="Phone (10 digits)"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full p-3 mb-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none text-base"
          />
          <input
            type="text"
            placeholder="Relationship (e.g., Son, Daughter, Doctor)"
            value={formData.relationship}
            onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
            className="w-full p-3 mb-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none text-base"
          />
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.notify}
              onChange={(e) => setFormData({ ...formData, notify: e.target.checked })}
              className="w-5 h-5"
            />
            <span className="text-gray-700">Notify in emergencies</span>
          </label>
          <button
            onClick={handleAddContact}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg"
          >
            Save Contact
          </button>
        </motion.div>
      )}

      {/* Contacts List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="px-6 space-y-3"
      >
        {contacts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No contacts added yet</p>
            <p className="text-gray-400 text-sm">Add your emergency contacts to help you faster</p>
          </div>
        ) : (
          contacts.map((contact, index) => (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white border-2 border-gray-200 rounded-2xl p-4 shadow-md hover:shadow-lg transition"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{contact.name}</h3>
                  <p className="text-sm text-gray-500">{contact.relationship}</p>
                </div>
                {contact.notify && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-bold">🔔</span>}
              </div>
              <div className="flex gap-2">
                <a
                  href={`tel:${contact.phone}`}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2"
                >
                  <Phone size={18} /> Call
                </a>
                <button
                  onClick={() => handleSendAlert(contact)}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2"
                >
                  <MessageCircle size={18} /> WhatsApp
                </button>
                <button
                  onClick={() => handleDeleteContact(contact.id)}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-blue-50 border-l-4 border-blue-400 p-4 m-6 rounded-lg"
      >
        <h3 className="font-bold text-blue-800 mb-2">💡 About ICE Contacts</h3>
        <p className="text-blue-700 text-sm">
          ICE stands for "In Case of Emergency". Keep these contacts updated so we can notify them immediately when you need help.
        </p>
      </motion.div>
    </div>
  );
}
