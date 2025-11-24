
import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import type { Character, Dialogue, Environment } from './types';
import { Section } from './components/Section';
import { OutputBox } from './components/OutputBox';
import { RACE_OPTIONS, GENDER_OPTIONS, VOICE_OPTIONS, LIGHTING_OPTIONS, CAMERA_ANGLE_OPTIONS, SHOT_TYPE_OPTIONS, CAMERA_MOVEMENT_OPTIONS } from './constants';

const initialCharacter: Omit<Character, 'id'> = {
    race: 'Indonesia',
    customRace: '',
    gender: 'Pria',
    age: '25',
    outfit: 'Kaos putih dan celana jeans',
    hairstyle: 'Rambut pendek hitam',
    voice: 'Baritone',
    description: 'Seorang petualang yang pemberani.',
    imagePreviewUrl: null,
    isAnalyzing: false,
    lookAtCamera: false,
};

// Helper to read a file as a Data URL (base64)
const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};


// Helper Components
const InputField: React.FC<{ label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string, type?: string, disabled?: boolean }> = ({ label, value, onChange, placeholder, type = 'text', disabled = false }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-on-surface-muted mb-1">{label}</label>
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} className="w-full bg-brand-bg border border-border-color rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-primary transition disabled:opacity-50" />
    </div>
);

const SelectField: React.FC<{ label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: readonly string[] | readonly { value: string; description: string; }[], disabled?: boolean }> = ({ label, value, onChange, options, disabled = false }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-on-surface-muted mb-1">{label}</label>
        <select value={value} onChange={onChange} disabled={disabled} className="w-full bg-brand-bg border border-border-color rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-primary transition disabled:opacity-50">
            {options.map((opt, index) => {
                const optionValue = typeof opt === 'string' ? opt : opt.value;
                const optionLabel = typeof opt === 'string' ? opt : `${opt.value} - ${opt.description}`;
                return <option key={index} value={optionValue}>{optionLabel}</option>
            })}
        </select>
    </div>
);

const TextAreaField: React.FC<{ label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder?: string, disabled?: boolean }> = ({ label, value, onChange, placeholder, disabled = false }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-on-surface-muted mb-1">{label}</label>
        <textarea value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} rows={3} className="w-full bg-brand-bg border border-border-color rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-primary transition disabled:opacity-50" />
    </div>
);

const CheckboxField: React.FC<{ label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; disabled?: boolean }> = ({ label, checked, onChange, disabled = false }) => (
    <div className="mb-4 flex items-center">
        <input 
            type="checkbox" 
            checked={checked} 
            onChange={onChange} 
            disabled={disabled} 
            className="w-4 h-4 text-primary bg-brand-bg border-border-color rounded focus:ring-primary focus:ring-2 transition disabled:opacity-50" 
        />
        <label className="ml-2 block text-sm font-medium text-on-surface cursor-pointer" onClick={() => !disabled && onChange({ target: { checked: !checked } } as any)}>{label}</label>
    </div>
);

const LoadingSpinner: React.FC = () => (
    <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center rounded-lg">
        <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-white mt-2 text-sm">Menganalisis Gambar...</p>
    </div>
);


export default function App() {
    const [characters, setCharacters] = useState<Character[]>([{...initialCharacter, id: crypto.randomUUID() }]);
    const [dialogues, setDialogues] = useState<Dialogue[]>([]);
    const [environment, setEnvironment] = useState<Environment>({
        description: 'Sebuah pasar malam yang ramai di Jakarta',
        lighting: 'neon lighting',
        cameraAngle: 'eye-level shot',
        shotType: 'medium shot',
        cameraMovement: 'static camera',
        style: 'realistis, sinematik',
    });
    
    const [negativePrompt, setNegativePrompt] = useState('bad quality, distorted, blurry, watermark, text overlay, bad anatomy, deformed, ugly, pixelated, low resolution, static camera (if movement requested), shaky camera (if static requested)');

    const [promptIndo, setPromptIndo] = useState('');
    const [promptEng, setPromptEng] = useState('');
    const [promptJson, setPromptJson] = useState('');
    const [promptSystem, setPromptSystem] = useState('');

    const generatePrompts = useCallback(() => {
        const getLanguageContext = (char: Character) => {
            const race = char.race === 'Lainnya...' ? char.customRace : char.race;
            
            let indoStyle = 'Bahasa Indonesia';
            let engStyle = 'Indonesian language';
    
            if (race === 'Indonesia') {
                 indoStyle = 'Bahasa Indonesia';
                 engStyle = 'Indonesian language';
            } else if (race && race.startsWith('Indonesia-')) {
                const region = race.replace('Indonesia-', '');
                indoStyle = `Bahasa Indonesia logat ${region}`;
                engStyle = `Indonesian language with ${region} accent`;
            } else if (race) {
                indoStyle = `Bahasa/Aksen ${race}`;
                engStyle = `${race} language/accent`;
            }
            
            return { indoStyle, engStyle };
        };

        // Construct narrative prompts
        // Indonesian Prompt
        let indo = `Video sinematik dengan gaya ${environment.style}. `;
        indo += `Adegan berlatar di ${environment.description} dengan pencahayaan ${environment.lighting}. `;
        indo += `Teknis Kamera: ${environment.shotType}, ${environment.cameraAngle}.\n`;
        indo += `Gerakan Kamera: ${environment.cameraMovement} (Lihat deskripsi teknis Inggris untuk presisi).\n\n`;
        
        indo += `KARAKTER:\n`;
        characters.forEach((c, i) => {
            const race = c.race === 'Lainnya...' ? c.customRace : c.race;
            const eyeContact = c.lookAtCamera ? "Karakter MENATAP LANGSUNG ke kamera (kontak mata)." : "Karakter tidak melihat ke kamera (candid).";
            indo += `- Karakter ${i + 1}: Seorang ${c.gender} ras ${race} berusia ${c.age} tahun. Mengenakan ${c.outfit}. Gaya rambut ${c.hairstyle}. ${eyeContact} Aksi/Deskripsi: ${c.description}\n`;
        });

        if (dialogues.length > 0) {
            indo += `\nDIALOG (Naskah):\n`;
            dialogues.forEach(d => {
                const charIndex = characters.findIndex(c => c.id === d.characterId);
                const char = characters[charIndex];
                let langStyle = '';
                if (char) {
                    langStyle = ` (${getLanguageContext(char).indoStyle})`;
                }
                indo += `- Karakter ${charIndex + 1}${langStyle}: "${d.text}"\n`;
            });
        }
        indo += `\nNEGATIVE PROMPT: ${negativePrompt}`;
        setPromptIndo(indo);

        // English Prompt (Targeting VEO3)
        let eng = `High quality cinematic video, ${environment.style} art style. `;
        eng += `The environment is ${environment.description}, illuminated by ${environment.lighting}. `;
        eng += `Camera specifications: ${environment.shotType}, ${environment.cameraAngle}. `;
        eng += `Camera Movement: ${environment.cameraMovement.toUpperCase()}.\n\n`;

        eng += `CHARACTERS:\n`;
        characters.forEach((c, i) => {
            const race = c.race === 'Lainnya...' ? c.customRace : c.race;
            const gender = c.gender === 'Pria' ? 'male' : c.gender === 'Wanita' ? 'female' : 'non-binary';
            const eyeContact = c.lookAtCamera ? "LOOKING DIRECTLY AT CAMERA, making eye contact." : "Not looking at camera, looking at surroundings.";
            eng += `- Character ${i + 1}: A ${c.age}-year-old ${race} ${gender}. Wearing ${c.outfit}. ${c.hairstyle} hairstyle. ${eyeContact} Action/Description: ${c.description}\n`;
        });

        if (dialogues.length > 0) {
            eng += `\nDIALOGUE SCRIPT:\n`;
            dialogues.forEach(d => {
                const charIndex = characters.findIndex(c => c.id === d.characterId);
                const char = characters[charIndex];
                let langStyle = '';
                if (char) {
                    langStyle = ` [speaking in ${getLanguageContext(char).engStyle}]`;
                }
                eng += `- Character ${charIndex + 1}${langStyle}: "${d.text}"\n`;
            });
        }
        eng += `\nNEGATIVE PROMPT: ${negativePrompt}`;
        setPromptEng(eng);

        // System Instruction Generator (For Chat Models to play the role)
        let sysParams = `Role: Professional Cinematographer and Screenwriter.\n`;
        sysParams += `Context: You are writing a scene set in ${environment.description}.\n`;
        sysParams += `Technical Constraints: Style: ${environment.style}, Lighting: ${environment.lighting}, Camera: ${environment.shotType}/${environment.cameraAngle}, Movement: ${environment.cameraMovement}.\n\n`;
        sysParams += `Characters:\n`;
        characters.forEach((c, i) => {
             const race = c.race === 'Lainnya...' ? c.customRace : c.race;
             sysParams += `[ID: ${i+1}] Name: Character ${i+1}, Details: ${c.age}yo ${c.gender} (${race}), ${c.outfit}, ${c.hairstyle}. Mood/Action: ${c.description}.\n`;
        });
        sysParams += `\nTask: Generate a detailed script, visual narration, or further dialogue for this scene while strictly adhering to the technical constraints and character descriptions provided above.`;
        setPromptSystem(sysParams);

        // Improved JSON Construction for API/VEO3 Usage
        const jsonObject = {
            meta: {
                generator: "VEO3 Prompt Generator",
                version: "1.2",
                target_model: "VEO3 / Gemini Video"
            },
            prompt: eng.replace(`\nNEGATIVE PROMPT: ${negativePrompt}`, '').trim(),
            negative_prompt: negativePrompt,
            
            parameters: {
                aspect_ratio: "16:9",
                resolution: "1080p",
                frame_rate: 24,
                sample_count: 1
            },
            
            structured_data: {
                scene: {
                    environment: environment.description,
                    lighting: environment.lighting,
                    style: environment.style,
                    camera: {
                        angle: environment.cameraAngle,
                        shot_type: environment.shotType,
                        movement: environment.cameraMovement
                    },
                },
                characters: characters.map((c, i) => ({
                    id: `char_${i + 1}`,
                    attributes: {
                        race: c.race === 'Lainnya...' ? c.customRace : c.race,
                        gender: c.gender,
                        age: c.age,
                        outfit: c.outfit,
                        hairstyle: c.hairstyle,
                        eye_contact: c.lookAtCamera
                    },
                    action: c.description,
                })),
                dialogues: dialogues.map(d => {
                    const charIndex = characters.findIndex(c => c.id === d.characterId);
                    return {
                        speaker: `char_${charIndex + 1}`,
                        text: d.text,
                    };
                }),
            }
        };
        setPromptJson(JSON.stringify(jsonObject, null, 2));

    }, [characters, dialogues, environment, negativePrompt]);
    
    useEffect(() => {
        generatePrompts();
    }, [generatePrompts]);

    // Cleanup object URLs on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            characters.forEach(char => {
                if (char.imagePreviewUrl && char.imagePreviewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(char.imagePreviewUrl);
                }
            });
        };
    }, [characters]);


    const handleAddCharacter = () => {
        setCharacters(prevChars => [...prevChars, { ...initialCharacter, id: crypto.randomUUID() }]);
    };

    const handleUpdateCharacter = (id: string, field: keyof Character, value: any) => {
        setCharacters(prevChars => prevChars.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleUpdateCharacterBatch = (id: string, updates: Partial<Character>) => {
        setCharacters(prevChars => prevChars.map(c => c.id === id ? { ...c, ...updates } : c));
    };
    
    const handleCharacterImageChange = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('File yang dipilih bukan gambar. Silakan pilih file dengan format gambar (JPEG, PNG, dll.).');
            return;
        }
        
        // Revoke old object URL if it exists
        const oldUrl = characters.find(c => c.id === id)?.imagePreviewUrl;
        if (oldUrl && oldUrl.startsWith('blob:')) {
            URL.revokeObjectURL(oldUrl);
        }
        
        const newImagePreviewUrl = URL.createObjectURL(file);
        
        // Start loading state
        handleUpdateCharacterBatch(id, {
            imagePreviewUrl: newImagePreviewUrl,
            isAnalyzing: true
        });

        let base64Image: string;
        try {
            base64Image = await fileToDataUrl(file);
        } catch (readError) {
            console.error("File Read Error:", readError);
            alert("Gagal membaca file gambar. Silakan coba file lain.");
            handleUpdateCharacter(id, 'isAnalyzing', false);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const imagePart = {
                inlineData: {
                    data: base64Image.split(',')[1],
                    mimeType: file.type,
                },
            };

            const textPart = {
                text: `PENTING: Respons Anda HARUS berupa objek JSON tunggal yang valid.
Anda adalah asisten ahli analisis visual. Berdasarkan gambar yang diberikan, ekstrak informasi berikut dan kembalikan sebagai JSON. Semua nilai harus dalam Bahasa Indonesia.
- race: Pilih SATU dari daftar ini: ${RACE_OPTIONS.filter(r => r !== 'Lainnya...').join(', ')}. Jika tidak ada yang cocok, pilih yang paling mendekati.
- gender: Pilih SATU dari daftar ini: ${GENDER_OPTIONS.join(', ')}.
- age: Perkirakan usia sebagai string angka (contoh: "32").
- outfit: Deskripsikan pakaian yang dikenakan secara detail.
- hairstyle: Deskripsikan gaya rambut secara detail.
- description: Tulis deskripsi singkat satu kalimat tentang penampilan umum, ekspresi, atau tindakan orang dalam gambar.`
            };
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    race: { type: Type.STRING },
                    gender: { type: Type.STRING },
                    age: { type: Type.STRING },
                    outfit: { type: Type.STRING },
                    hairstyle: { type: Type.STRING },
                    description: { type: Type.STRING },
                },
                required: ["race", "gender", "age", "outfit", "hairstyle", "description"],
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart, textPart] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema,
                },
            });

            const resultJson = JSON.parse(response.text);
            const foundRace = RACE_OPTIONS.find(opt => opt.toLowerCase() === resultJson.race?.toLowerCase());
            const normalizedRace = foundRace || 'Lainnya...';

            handleUpdateCharacterBatch(id, {
                race: normalizedRace,
                customRace: normalizedRace === 'Lainnya...' ? resultJson.race : '',
                gender: resultJson.gender || 'Pria',
                age: resultJson.age || '',
                outfit: resultJson.outfit || '',
                hairstyle: resultJson.hairstyle || '',
                description: resultJson.description || '',
            });

        } catch (apiError) {
            console.error("AI Analysis Error:", apiError);
            alert("Gagal menganalisis gambar. Pastikan gambar jelas dan coba lagi. Periksa konsol untuk detail teknis.");
        } finally {
            handleUpdateCharacter(id, 'isAnalyzing', false);
        }
    };

    const handleDeleteCharacter = (id: string) => {
        setCharacters(prevChars => {
            const characterToDelete = prevChars.find(c => c.id === id);
            if (characterToDelete?.imagePreviewUrl?.startsWith('blob:')) {
                URL.revokeObjectURL(characterToDelete.imagePreviewUrl);
            }
            return prevChars.filter(c => c.id !== id);
        });

        setDialogues(prevDialogues => prevDialogues.filter(d => d.characterId !== id));
    };

    const handleAddDialogue = () => {
        if (characters.length > 0) {
            setDialogues(prev => [...prev, { id: crypto.randomUUID(), characterId: characters[0].id, text: '' }]);
        }
    };

    const handleUpdateDialogue = (id: string, field: keyof Dialogue, value: string) => {
        setDialogues(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    };

    const handleDeleteDialogue = (id: string) => {
        setDialogues(prev => prev.filter(d => d.id !== id));
    };
    
    const handleUpdateEnvironment = (field: keyof Environment, value: string) => {
        setEnvironment(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="min-h-screen p-4 md:p-8">
            <header className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-bold text-white">VEO3 Prompt Generator</h1>
                <p className="text-on-surface-muted mt-2">Buat prompt video kompleks dengan mudah. Unggah gambar untuk deskripsi karakter otomatis!</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Inputs Column */}
                <div>
                    {/* Section 1: Environment & Camera */}
                    <Section title="1. Lingkungan & Kamera">
                        <InputField label="Deskripsi Lingkungan" value={environment.description} onChange={(e) => handleUpdateEnvironment('description', e.target.value)} placeholder="e.g., Hutan pinus berkabut di pagi hari" />
                        <InputField label="Gaya Visual" value={environment.style} onChange={(e) => handleUpdateEnvironment('style', e.target.value)} placeholder="e.g., Fantasi, sureal, anime 80an" />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SelectField label="Pencahayaan" value={environment.lighting} onChange={(e) => handleUpdateEnvironment('lighting', e.target.value)} options={LIGHTING_OPTIONS} />
                            <SelectField label="Gerakan Kamera (Movement)" value={environment.cameraMovement} onChange={(e) => handleUpdateEnvironment('cameraMovement', e.target.value)} options={CAMERA_MOVEMENT_OPTIONS} />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <SelectField label="Sudut Kamera (Angle)" value={environment.cameraAngle} onChange={(e) => handleUpdateEnvironment('cameraAngle', e.target.value)} options={CAMERA_ANGLE_OPTIONS} />
                             <SelectField label="Tipe Shot" value={environment.shotType} onChange={(e) => handleUpdateEnvironment('shotType', e.target.value)} options={SHOT_TYPE_OPTIONS} />
                        </div>
                        
                        <TextAreaField label="Negative Prompt (Hal yang dihindari)" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="Elemen yang tidak diinginkan..." />

                    </Section>

                    {/* Section 2: Characters */}
                    <Section title="2. Karakter" actions={<button onClick={handleAddCharacter} className="bg-primary hover:bg-primary-variant text-white font-bold py-2 px-4 rounded transition-colors">Tambah Karakter</button>}>
                       {characters.map((char, index) => (
                           <div key={char.id} className="bg-brand-bg p-4 rounded-lg mb-4 border border-border-color">
                               <div className="flex justify-between items-center mb-3">
                                   <h3 className="text-lg font-semibold text-on-surface">Karakter {index + 1}</h3>
                                   <button onClick={() => handleDeleteCharacter(char.id)} className="text-red-500 hover:text-red-400 font-bold py-1 px-3 rounded">Hapus</button>
                               </div>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <SelectField label="Ras/Etnis" value={char.race} onChange={(e) => handleUpdateCharacter(char.id, 'race', e.target.value)} options={RACE_OPTIONS} disabled={char.isAnalyzing} />
                                        {char.race === 'Lainnya...' && <InputField label="Ras Kustom" value={char.customRace} onChange={(e) => handleUpdateCharacter(char.id, 'customRace', e.target.value)} placeholder="e.g., Elf, Cyborg" disabled={char.isAnalyzing} />}
                                        <div className="grid grid-cols-2 gap-2">
                                            <SelectField label="Gender" value={char.gender} onChange={(e) => handleUpdateCharacter(char.id, 'gender', e.target.value)} options={GENDER_OPTIONS} disabled={char.isAnalyzing} />
                                            <InputField label="Usia" type="number" value={char.age} onChange={(e) => handleUpdateCharacter(char.id, 'age', e.target.value)} placeholder="e.g., 30" disabled={char.isAnalyzing} />
                                        </div>
                                        <InputField label="Outfit" value={char.outfit} onChange={(e) => handleUpdateCharacter(char.id, 'outfit', e.target.value)} placeholder="e.g., Jaket kulit hitam" disabled={char.isAnalyzing} />
                                        <InputField label="Gaya Rambut" value={char.hairstyle} onChange={(e) => handleUpdateCharacter(char.id, 'hairstyle', e.target.value)} placeholder="e.g., Mohawk" disabled={char.isAnalyzing} />
                                        <SelectField label="Suara" value={char.voice} onChange={(e) => handleUpdateCharacter(char.id, 'voice', e.target.value)} options={VOICE_OPTIONS} disabled={char.isAnalyzing} />
                                    </div>
                                    <div>
                                       <TextAreaField label="Deskripsi & Aksi" value={char.description} onChange={(e) => handleUpdateCharacter(char.id, 'description', e.target.value)} placeholder="e.g., Sedang duduk di kafe sambil membaca buku." disabled={char.isAnalyzing} />
                                       
                                       {/* Look At Camera Toggle */}
                                       <div className="my-3 p-3 bg-surface rounded-md border border-border-color/50">
                                            <CheckboxField 
                                                label="Tatapan Mata: Menatap Kamera" 
                                                checked={char.lookAtCamera} 
                                                onChange={(e) => handleUpdateCharacter(char.id, 'lookAtCamera', e.target.checked)} 
                                                disabled={char.isAnalyzing}
                                            />
                                            <p className="text-xs text-on-surface-muted ml-6">Aktifkan jika ingin karakter melakukan kontak mata dengan penonton (breaking the fourth wall) atau untuk video presentasi.</p>
                                       </div>

                                       <div className="mb-4">
                                            <label className="block text-sm font-medium text-on-surface-muted mb-1">Gambar Referensi (Opsional)</label>
                                            <input type="file" accept="image/*" onChange={(e) => handleCharacterImageChange(char.id, e)} disabled={char.isAnalyzing} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-variant file:text-secondary hover:file:bg-primary disabled:opacity-50 disabled:cursor-not-allowed" />
                                        </div>
                                        <div className="relative">
                                            {char.imagePreviewUrl && <img src={char.imagePreviewUrl} alt="Preview" className="mt-2 rounded-lg w-full h-48 object-contain bg-black/20" />}
                                            {char.isAnalyzing && <LoadingSpinner />}
                                        </div>
                                    </div>
                               </div>
                           </div>
                       ))}
                    </Section>

                    {/* Section 3: Dialogue */}
                    <Section title="3. Dialog" actions={<button onClick={handleAddDialogue} disabled={characters.length === 0} className="bg-primary hover:bg-primary-variant text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">Tambah Dialog</button>}>
                       {dialogues.map((dialogue) => (
                           <div key={dialogue.id} className="flex items-start gap-4 mb-3 p-3 bg-brand-bg rounded-lg border border-border-color">
                               <select value={dialogue.characterId} onChange={(e) => handleUpdateDialogue(dialogue.id, 'characterId', e.target.value)} className="bg-surface border border-border-color rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-primary transition">
                                   {characters.map((c, i) => <option key={c.id} value={c.id}>Karakter {i + 1}</option>)}
                               </select>
                               <textarea value={dialogue.text} onChange={(e) => handleUpdateDialogue(dialogue.id, 'text', e.target.value)} placeholder={`Teks dialog untuk karakter...`} rows={2} className="flex-grow bg-surface border border-border-color rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-primary transition" />
                               <button onClick={() => handleDeleteDialogue(dialogue.id)} className="text-red-500 hover:text-red-400 font-bold py-1 px-3 self-center">Hapus</button>
                           </div>
                       ))}
                       {characters.length === 0 && <p className="text-on-surface-muted">Harap tambahkan karakter terlebih dahulu untuk memulai dialog.</p>}
                    </Section>
                </div>

                {/* Outputs Column */}
                <div className="sticky top-8 self-start">
                    <h2 className="text-2xl font-bold mb-4 text-center text-white">Hasil Prompt</h2>
                    <OutputBox title="Bahasa Indonesia" content={promptIndo} />
                    <OutputBox title="Bahasa Inggris (Recommended for VEO3)" content={promptEng} />
                    <OutputBox title="System Instruction (Untuk Scriptwriter AI)" content={promptSystem} />
                    <OutputBox title="JSON Payload (API Ready)" content={promptJson} />
                </div>
            </div>
        </div>
    );
}
