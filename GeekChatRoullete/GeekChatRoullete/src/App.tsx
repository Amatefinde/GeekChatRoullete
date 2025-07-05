// src/App.tsx

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    Container, Box, Typography, Select, MenuItem,
    FormControl, InputLabel, TextField, Button, Slider,
        Paper, List, ListItem, CssBaseline, ThemeProvider, createTheme,
    Stack, IconButton, CircularProgress, Alert, useMediaQuery, useTheme, Avatar
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import LogoutIcon from '@mui/icons-material/Logout';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import { motion, AnimatePresence } from 'framer-motion';

// ====================================================================================
// 1. ТИПЫ И НАСТРОЙКИ
// ====================================================================================

interface SearchCriteria {
    myGender: 'male' | 'female';
    myAge: number;
    partnerGender: 'male' | 'female' | 'any';
    partnerAge: { min: number; max: number; };
}
interface Message {
    text: string;
    time: string;
    from: 'me' | 'partner';
}
interface ServerToClientEvents {
    chat_found: () => void;
    searching: (data: { message:string }) => void;
    receive_message: (data: Omit<Message, 'from'>) => void;
    partner_disconnected: (data: { message: string }) => void;
}
interface ClientToServerEvents {
    start_search: (criteria: SearchCriteria) => void;
    send_message: (data: Omit<Message, 'from'>) => void;
}

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io("http://localhost:3001");

const beautifulTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#00BFFF' },
        secondary: { main: '#f48fb1' },
        background: { paper: 'rgba(255, 255, 255, 0.09)' },
    },
    typography: { fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif', h4: { fontWeight: 500 } },
    components: {
        MuiMenu: {
            styleOverrides: {
                paper: { backgroundColor: '#1e2732', backgroundImage: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' },
            },
        },
    },
});

const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

// ====================================================================================
// 2. КОМПОНЕНТ ЭКРАНА ПОИСКА (SearchScreen)
// ====================================================================================
interface SearchScreenProps {
    onSearch: (criteria: SearchCriteria) => void;
}
const SearchScreen: React.FC<SearchScreenProps> = ({ onSearch }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [myGender, setMyGender] = useState<'male' | 'female'>('male');
    const [myAge, setMyAge] = useState<number>(25);
    const [partnerGender, setPartnerGender] = useState<'male' | 'female' | 'any'>('any');
    const [partnerAge, setPartnerAge] = useState<number[]>([18, 40]);
    const handleSearch = () => onSearch({ myGender, myAge, partnerGender, partnerAge: { min: partnerAge[0], max: partnerAge[1] } });
    return (
        <Container maxWidth="sm">
            <Paper sx={{ p: isMobile ? 3 : 4, borderRadius: 4, backdropFilter: 'blur(10px)', backgroundColor: 'rgba(30, 30, 40, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)' }}>
                <Stack spacing={3} alignItems="center">
                    <Typography variant={isMobile ? 'h5' : 'h4'} component="h1" sx={{ background: 'linear-gradient(45deg, #00BFFF 30%, #f48fb1 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>Geek Chat Roulette</Typography>
                    <Typography>Ваш профиль</Typography>
                    <FormControl fullWidth><InputLabel>Ваш пол</InputLabel><Select value={myGender} label="Ваш пол" onChange={(e) => setMyGender(e.target.value as 'male' | 'female')}><MenuItem value="male">Мужчина</MenuItem><MenuItem value="female">Женщина</MenuItem></Select></FormControl>
                    <TextField fullWidth label="Ваш возраст" type="number" value={myAge} onChange={(e) => setMyAge(Number(e.target.value))} />
                    <Typography>Кого ищем?</Typography>
                    <FormControl fullWidth><InputLabel>Пол собеседника</InputLabel><Select value={partnerGender} label="Пол собеседника" onChange={(e) => setPartnerGender(e.target.value as 'any' | 'male' | 'female')}><MenuItem value="any">Любой</MenuItem><MenuItem value="male">Мужчина</MenuItem><MenuItem value="female">Женщина</MenuItem></Select></FormControl>
                    <Typography gutterBottom>Возраст собеседника: {partnerAge[0]} - {partnerAge[1]}</Typography>
                    <Slider value={partnerAge} onChange={(_e, val) => setPartnerAge(val as number[])} valueLabelDisplay="auto" min={18} max={99} />
                    <Button variant="contained" size="large" onClick={handleSearch} sx={{ mt: 2, width: '100%', py: 1.5, borderRadius: '12px' }}>Начать поиск</Button>
                </Stack>
            </Paper>
        </Container>
    );
};

// ====================================================================================
// 3. КОМПОНЕНТ ЧАТА С ИСПРАВЛЕННОЙ ВЕРСТКОЙ
// ====================================================================================
interface ChatProps {
    messages: Message[];
    notification: string;
    onSendMessage: (messageText: string) => void;
    onExit: () => void;
}

const Chat: React.FC<ChatProps> = ({ messages, onSendMessage, notification, onExit }) => {
    const [currentMessage, setCurrentMessage] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = () => {
        if (currentMessage.trim()) {
            onSendMessage(currentMessage);
            setCurrentMessage('');
        }
    };

    const formatTime = (isoString: string) => {
        try {
            return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '--:--';
        }
    };

    return (
        <Container maxWidth="md" sx={{ height: '95vh', display: 'flex', flexDirection: 'column', p: { xs: 1, sm: 2 } }}>
            <Stack component={Paper} elevation={6} sx={{ flexGrow: 1, p: { xs: 1, sm: 2 }, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(20, 25, 35, 0.7)', backdropFilter: 'blur(10px)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
                    <GroupsIcon color="primary" />
                    <Typography variant="h6" sx={{ ml: 2, flexGrow: 1 }}>Чат с незнакомцем</Typography>
                    <IconButton onClick={onExit} sx={{ml: 'auto'}} title="Выйти из чата"><LogoutIcon /></IconButton>
                </Box>

                <List sx={{ flexGrow: 1, overflowY: 'auto', p: { xs: 1, sm: 2 } }}>
                    <AnimatePresence>
                        {messages.map((msg, index) => (
                            <ListItem
                                key={index}
                                sx={{
                                    display: 'flex',
                                    justifyContent: msg.from === 'me' ? 'flex-end' : 'flex-start',
                                    width: '100%', // Важно!
                                    p: 0,
                                    my: 1,
                                }}
                                component={motion.li}
                                layout
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 250, damping: 25 }}
                            >
                                <Stack direction="row" spacing={1} alignItems="flex-end"
                                       sx={{
                                           width: 'auto',
                                           maxWidth: '100%',
                                           ml: msg.from === 'me' ? 'auto' : 0, // Важно! Прижимает к правому краю
                                           mr: msg.from === 'partner' ? 'auto' : 0, // Для собеседника — к левому
                                       }}
                                >
                                    {msg.from === 'partner' && <Avatar sx={{ width: 28, height: 28, bgcolor: '#3e4a59' }}><PersonIcon fontSize="small"/></Avatar>}
                                    <Stack sx={{
                                        p: '8px 16px',
                                        borderRadius: msg.from === 'me' ? '20px 5px 20px 20px' : '5px 20px 20px 20px',
                                        background: msg.from === 'me' ? 'linear-gradient(45deg, #0077B6, #00BFFF)' : '#37474F',
                                        color: 'white',
                                        maxWidth: { xs: '90vw', sm: '80vw', md: '70vw' }, // Лучше vw, чтобы не было переполнения
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                        alignSelf: msg.from === 'me' ? 'flex-end' : 'flex-start', // Важно!
                                    }}>
                                        <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>{msg.text}</Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.7, alignSelf: 'flex-end', mt: 0.5 }}>{formatTime(msg.time)}</Typography>
                                    </Stack>
                                    {msg.from === 'me' && <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main' }}><PersonIcon fontSize="small"/></Avatar>}
                                </Stack>
                            </ListItem>

                        ))}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </List>

                {notification && <Alert severity="info" sx={{m: 1, bgcolor: 'rgba(255,255,255,0.1)'}}>{notification}</Alert>}

                <Box component="form" sx={{ display: 'flex', p: 1, alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.12)' }} onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
                    <TextField fullWidth variant="outlined" size="small" placeholder="Напишите сообщение..." value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px', bgcolor: 'rgba(0,0,0,0.2)' } }} />
                    <IconButton type="submit" color="primary" sx={{ ml: 1 }} disabled={!currentMessage.trim()}><SendIcon /></IconButton>
                </Box>
            </Stack>
        </Container>
    );
}

// ====================================================================================
// 4. ГЛАВНЫЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ (App)
// ====================================================================================
function App() {
    type ChatState = 'config' | 'searching' | 'chat';
    const [chatState, setChatState] = useState<ChatState>('config');
    const [messages, setMessages] = useState<Message[]>([]);
    const [notification, setNotification] = useState<string>('');

    useEffect(() => {
        socket.on('chat_found', () => { setMessages([]); setNotification(''); setChatState('chat'); });
        socket.on('receive_message', (data) => setMessages((list) => [...list, { ...data, from: 'partner' }]));
        socket.on('partner_disconnected', (data) => {
            setNotification(data.message);
            const timer = setTimeout(() => {
                setChatState('config');
                setNotification('');
            }, 4000);
            return () => clearTimeout(timer);
        });

        return () => {
            socket.off('chat_found');
            socket.off('receive_message');
            socket.off('partner_disconnected');
        };
    }, []);

    const startSearch = (criteria: SearchCriteria) => { socket.emit('start_search', criteria); setChatState('searching'); };
    const sendMessage = (messageText: string) => {
        const messageData = { text: messageText, time: new Date().toISOString() };
        socket.emit('send_message', messageData);
        setMessages((list) => [...list, { ...messageData, from: 'me' }]);
    };
    const handleExitChat = () => {
        socket.disconnect();
        socket.connect();
        setChatState('config');
        setMessages([]);
        setNotification('');
    };

    const renderContent = () => {
        switch (chatState) {
            case 'searching':
                return (
                    <motion.div key="searching" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
                        <Stack spacing={2} alignItems="center" sx={{ color: 'primary.light' }}>
                            <CircularProgress size={60} color="inherit" />
                            <Typography variant="h5">Ищем гика для общения...</Typography>
                        </Stack>
                    </motion.div>
                );
            case 'chat':
                return (
                    <motion.div key="chat" variants={containerVariants} initial="hidden" animate="visible" exit="exit" style={{width: '100%'}}>
                        <Chat messages={messages} onSendMessage={sendMessage} notification={notification} onExit={handleExitChat}/>
                    </motion.div>
                );
            case 'config':
            default:
                return (
                    <motion.div key="config" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
                        <SearchScreen onSearch={startSearch} />
                    </motion.div>
                );
        }
    };

    return (
        <ThemeProvider theme={beautifulTheme}>
            <CssBaseline />
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100vw', background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)', overflow: 'hidden' }}>
                <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
            </Box>
        </ThemeProvider>
    );
}

export default App;