import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MonitorPlay, Users, Sparkles, ArrowRight, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [roomId, setRoomId] = useState('');
  const [generatedRoomId, setGeneratedRoomId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setGeneratedRoomId(id);
    return id;
  };

  const handleCreateRoom = () => {
    const id = generateRoomId();
    toast({
      title: 'Room Created!',
      description: `Your room ID is ${id}. Share it with a friend to start watching together.`,
    });
  };

  const handleJoinRoom = () => {
    const targetId = generatedRoomId || roomId.trim().toUpperCase();
    
    // Input validation: Room ID must be 4-20 alphanumeric characters
    if (!targetId || targetId.length < 4 || targetId.length > 20) {
      toast({
        title: 'Invalid Room ID',
        description: 'Room ID must be between 4 and 20 characters.',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate alphanumeric only
    if (!/^[A-Z0-9]+$/i.test(targetId)) {
      toast({
        title: 'Invalid Room ID',
        description: 'Room ID can only contain letters and numbers.',
        variant: 'destructive',
      });
      return;
    }
    
    navigate(`/room/${targetId}`);
  };

  const copyRoomId = () => {
    if (generatedRoomId) {
      navigator.clipboard.writeText(generatedRoomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied!',
        description: 'Room ID copied to clipboard.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-primary/20 text-primary mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Real-time reactions</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 tracking-tight">
            Watch Together
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Share your screen, see each other's reactions, and enjoy movies together in real-time — 
            no matter where you are.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full mb-12">
          {[
            { icon: MonitorPlay, title: 'Screen Share', desc: 'Share any movie or show' },
            { icon: Users, title: 'Live Reactions', desc: 'See each other react' },
            { icon: Sparkles, title: 'Near-Zero Latency', desc: 'WebRTC powered' },
          ].map((feature, i) => (
            <div
              key={feature.title}
              className="flex items-center gap-3 p-4 rounded-xl glass animate-fade-in"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Room Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
          {/* Create Room */}
          <Card className="glass border-border/50 animate-scale-in">
            <CardHeader>
              <CardTitle className="text-xl">Create a Room</CardTitle>
              <CardDescription>Start a new watch party and invite a friend</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {generatedRoomId ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-3 rounded-lg bg-secondary text-center">
                      <span className="text-2xl font-mono font-bold tracking-widest text-primary">
                        {generatedRoomId}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={copyRoomId}
                      className="h-12 w-12"
                    >
                      {copied ? <Check className="w-5 h-5 text-success" /> : <Copy className="w-5 h-5" />}
                    </Button>
                  </div>
                  <Button onClick={handleJoinRoom} className="w-full h-12 text-base font-semibold">
                    Enter Room
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleCreateRoom}
                  className="w-full h-12 text-base font-semibold"
                >
                  Generate Room ID
                  <Sparkles className="w-5 h-5 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Join Room */}
          <Card className="glass border-border/50 animate-scale-in" style={{ animationDelay: '100ms' }}>
            <CardHeader>
              <CardTitle className="text-xl">Join a Room</CardTitle>
              <CardDescription>Enter a room ID to join an existing session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Enter room ID..."
                value={roomId}
                onChange={(e) => {
                  // Only allow alphanumeric characters
                  const value = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
                  setRoomId(value.substring(0, 20)); // Max 20 characters
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && roomId.trim().length >= 4) {
                    handleJoinRoom();
                  }
                }}
                className="h-12 text-center text-lg font-mono tracking-widest uppercase"
                maxLength={20}
              />
              <Button
                onClick={handleJoinRoom}
                variant="secondary"
                className="w-full h-12 text-base font-semibold"
                disabled={!roomId.trim()}
              >
                Join Room
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-muted-foreground text-sm">
        <p>No account required • End-to-end encrypted • Open source</p>
      </footer>
    </div>
  );
};

export default Home;
