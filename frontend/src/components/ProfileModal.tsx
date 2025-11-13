import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";

type Profile = {
  age: number | "";
  gender: string;
  occupation: string;
  education_level: string;
  device_type: string;
  daily_usage_hours: number | "";
};

export const ProfileModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSave?: (profile: Profile) => void;
}> = ({ open, onClose, onSave }) => {
  const occupations = [
    "Engineer",
    "Doctor",
    "Teacher",
    "Artist",
    "Student",
    "Lawyer",
    "Chef",
    "Nurse",
    "Officer",
    "Developer",
    "Manager",
    "Researcher",
    "Professor",
    "Consultant",
    "Designer",
    "Analyst",
  ];

  const genders = ["Male", "Female", "Other"];
  const education = ["High School", "Bachelor", "Master", "PhD"];
  const devices = ["Mobile", "Desktop", "Tablet", "Laptop"];

  const [profile, setProfile] = useState<Profile>({
    age: "",
    gender: "Male",
    occupation: "Student",
    education_level: "Bachelor",
    device_type: "Mobile",
    daily_usage_hours: "",
  });

  useEffect(() => {
    if (!open) return;
    // load saved profile if exists
    try {
      const raw = localStorage.getItem("user_profile");
      if (raw) {
        const parsed = JSON.parse(raw);
        setProfile((p) => ({ ...p, ...parsed }));
      }
    } catch (e) {
      // ignore
    }
  }, [open]);

  const save = () => {
    // basic validation
    const cleaned = {
      age: Number(profile.age) || 0,
      gender: String(profile.gender),
      occupation: String(profile.occupation),
      education_level: String(profile.education_level),
      device_type: String(profile.device_type),
      daily_usage_hours: Number(profile.daily_usage_hours) || 0,
    };

    localStorage.setItem("user_profile", JSON.stringify(cleaned));
    if (onSave) onSave(cleaned);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-[#2b2b2b] rounded-xl p-6 text-gray-200 relative shadow-lg">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold mb-4">Your Profile</h2>

        <label className="text-sm text-gray-300">Age</label>
        <input
          type="number"
          value={profile.age}
          onChange={(e) => setProfile({ ...profile, age: e.target.value === "" ? "" : Number(e.target.value) })}
          className="w-full p-2 mb-3 mt-1 bg-[#1f1f1f] rounded-md text-gray-100 border border-gray-600"
          min={13}
          max={120}
        />

        <label className="text-sm text-gray-300">Gender</label>
        <select
          value={profile.gender}
          onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
          className="w-full p-2 mb-3 mt-1 bg-[#1f1f1f] rounded-md text-gray-100 border border-gray-600"
        >
          {genders.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <label className="text-sm text-gray-300">Occupation</label>
        <select
          value={profile.occupation}
          onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
          className="w-full p-2 mb-3 mt-1 bg-[#1f1f1f] rounded-md text-gray-100 border border-gray-600"
        >
          {occupations.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <label className="text-sm text-gray-300">Education level</label>
        <select
          value={profile.education_level}
          onChange={(e) => setProfile({ ...profile, education_level: e.target.value })}
          className="w-full p-2 mb-3 mt-1 bg-[#1f1f1f] rounded-md text-gray-100 border border-gray-600"
        >
          {education.map((ed) => (
            <option key={ed} value={ed}>
              {ed}
            </option>
          ))}
        </select>

        <label className="text-sm text-gray-300">Device type</label>
        <select
          value={profile.device_type}
          onChange={(e) => setProfile({ ...profile, device_type: e.target.value })}
          className="w-full p-2 mb-3 mt-1 bg-[#1f1f1f] rounded-md text-gray-100 border border-gray-600"
        >
          {devices.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <label className="text-sm text-gray-300">Daily usage hours</label>
        <input
          type="number"
          step="0.1"
          value={profile.daily_usage_hours}
          onChange={(e) => setProfile({ ...profile, daily_usage_hours: e.target.value === "" ? "" : Number(e.target.value) })}
          className="w-full p-2 mb-4 mt-1 bg-[#1f1f1f] rounded-md text-gray-100 border border-gray-600"
          min={0}
          max={24}
        />

        <div className="flex gap-2">
          <button
            onClick={save}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white"
          >
            <Save size={14} /> Save Profile
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-600 text-gray-200 hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
