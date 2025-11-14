'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Mic, Phone, FileText, Database, Settings, Shield, Webhook, Volume2, Play, Square, PhoneCall } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export default function TestCallCenterPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioURL, setAudioURL] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [summary, setSummary] = useState<any>(null)
  const [kbQuery, setKbQuery] = useState('')
  const [kbResults, setKbResults] = useState<any[]>([])
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioBlobSize, setAudioBlobSize] = useState(0)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const { toast } = useToast()

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Try to use a supported MIME type
      let mimeType = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          console.log('Audio chunk received:', event.data.size, 'bytes')
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(audioBlob)
        setAudioURL(url)
        setAudioBlobSize(audioBlob.size)
        console.log('Audio recorded:', { 
          size: audioBlob.size, 
          type: audioBlob.type, 
          chunks: audioChunksRef.current.length,
          url 
        })
        
        // Simulate transcription
        setTimeout(() => {
          setTranscript("Driver: Hi, I have a flat tire on I-95 northbound near mile marker 120. I'm blocking the right lane.\n\nAgent: I understand you have a tire issue. Can you confirm your exact location?\n\nDriver: Yes, I-95 northbound, mile marker 120, right lane. It's urgent, traffic is backing up.\n\nAgent: I'm dispatching a tire service now. They'll arrive in approximately 15 minutes. Please stay in your vehicle with hazards on.")
          
          setSummary({
            incidentType: 'Tire Blowout',
            urgency: 'High',
            location: 'I-95 Northbound, Mile Marker 120',
            actionItems: [
              'Dispatch tire service immediately',
              'ETA: 15 minutes',
              'Driver to remain in vehicle with hazards on'
            ],
            sentiment: 'Frustrated → Relieved',
            keyPhrases: ['flat tire', 'I-95', 'mile marker 120', 'blocking lane', 'urgent']
          })
        }, 1000)
      }

      mediaRecorder.start()
      setIsRecording(true)
      
      toast({
        title: 'Recording Started',
        description: 'Speak your incident description...',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not access microphone. Please allow microphone access.',
        variant: 'destructive',
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      setIsRecording(false)
      
      toast({
        title: 'Recording Stopped',
        description: 'Processing your audio...',
      })
    }
  }

  const playRecording = () => {
    if (audioURL && audioElementRef.current) {
      console.log('Playing audio from URL:', audioURL, 'Size:', audioBlobSize)
      
      if (audioBlobSize === 0) {
        toast({
          title: 'No Audio Data',
          description: 'The recording is empty. Please try recording again and speak into your microphone.',
          variant: 'destructive',
        })
        return
      }
      
      const audio = audioElementRef.current
      audio.src = audioURL
      
      audio.onerror = (e) => {
        console.error('Audio playback error:', e, audio.error)
        toast({
          title: 'Playback Error',
          description: `Error code: ${audio.error?.code}. Try recording again.`,
          variant: 'destructive',
        })
        setIsPlaying(false)
      }
      
      audio.onended = () => {
        setIsPlaying(false)
      }
      
      audio.onloadeddata = () => {
        console.log('Audio loaded, duration:', audio.duration)
      }
      
      audio.play().then(() => {
        console.log('Audio playing successfully')
        setIsPlaying(true)
      }).catch((error) => {
        console.error('Play failed:', error)
        toast({
          title: 'Playback Failed',
          description: error.message,
          variant: 'destructive',
        })
        setIsPlaying(false)
      })
    }
  }

  const testPhoneCall = () => {
    if (!phoneNumber) {
      toast({
        title: 'Phone Number Required',
        description: 'Please enter a phone number to test',
        variant: 'destructive',
      })
      return
    }

    // Simulate phone call
    toast({
      title: '📞 Test Call Initiated',
      description: `Calling ${phoneNumber}...`,
    })

    setTimeout(() => {
      // Play test message
      const utterance = new SpeechSynthesisUtterance(
        'This is a test call from RoadCall AI Assistant. This system is currently in test mode. No actual emergency services will be dispatched. Thank you for testing.'
      )
      utterance.rate = 0.9
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
      
      toast({
        title: '🎙️ Test Message Playing',
        description: 'This is just a test - no real call is being made',
      })
    }, 2000)
  }

  const testKnowledgeBase = () => {
    if (!kbQuery) {
      toast({
        title: 'Query Required',
        description: 'Please enter a question',
        variant: 'destructive',
      })
      return
    }

    // Simulate KB query
    setKbResults([
      {
        title: 'Tire Replacement SOP',
        excerpt: 'Standard procedure for tire replacement: 1) Ensure vehicle is on level ground, 2) Use wheel chocks, 3) Wear safety glasses and gloves...',
        confidence: 0.95,
        source: 'sop-tire-replacement.pdf'
      },
      {
        title: 'Emergency Response Protocol',
        excerpt: 'For highway incidents blocking traffic: Dispatch immediately, notify highway patrol, provide ETA to driver...',
        confidence: 0.88,
        source: 'emergency-protocols.pdf'
      }
    ])
    
    toast({
      title: 'Knowledge Base Queried',
      description: `Found ${2} relevant documents`,
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Call Center Test Interface
          </h1>
          <p className="text-muted-foreground">Test AI-powered call transcription, summarization, and knowledge base</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Settings */}
          <div className="space-y-4">
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  <span>Functions</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start hover:bg-blue-50">
                  <Phone className="w-4 h-4 mr-2 text-blue-600" />
                  Call Settings
                </Button>
                <Button variant="outline" className="w-full justify-start hover:bg-purple-50">
                  <Volume2 className="w-4 h-4 mr-2 text-purple-600" />
                  Speech Settings
                </Button>
                <Button variant="outline" className="w-full justify-start hover:bg-green-50">
                  <FileText className="w-4 h-4 mr-2 text-green-600" />
                  Transcription Settings
                </Button>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Database className="w-5 h-5 text-purple-600" />
                  <span>Knowledge Base</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Ask a question... (e.g., What is the tire replacement procedure?)"
                  value={kbQuery}
                  onChange={(e) => setKbQuery(e.target.value)}
                  rows={3}
                  className="border-purple-200 focus:border-purple-400"
                />
                <Button onClick={testKnowledgeBase} className="w-full bg-purple-600 hover:bg-purple-700">
                  <Database className="w-4 h-4 mr-2" />
                  Query Knowledge Base
                </Button>
                
                {kbResults.length > 0 && (
                  <div className="space-y-2 mt-4">
                    {kbResults.map((result, i) => (
                      <div key={i} className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                        <p className="font-semibold text-sm text-purple-900">{result.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{result.excerpt}</p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge className="bg-purple-600 text-xs">
                            {(result.confidence * 100).toFixed(0)}% match
                          </Badge>
                          <span className="text-xs text-gray-500">{result.source}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  <span>Security</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>PII Redaction</span>
                    <Badge className="bg-green-600">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Encryption</span>
                    <Badge className="bg-green-600">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Guardrails</span>
                    <Badge className="bg-green-600">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Webhook className="w-5 h-5 text-orange-600" />
                  <span>Webhooks</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Configure post-call webhooks</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Test Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Test Phone Call */}
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PhoneCall className="w-6 h-6 text-blue-600" />
                  <span>Test Phone Call</span>
                </CardTitle>
                <CardDescription>Enter your number to receive a test call message</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-3">
                  <Input
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="flex-1 border-blue-200 focus:border-blue-400"
                  />
                  <Button onClick={testPhoneCall} className="bg-blue-600 hover:bg-blue-700">
                    <Phone className="w-4 h-4 mr-2" />
                    Test Call
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  ⚠️ This will play a test message - no actual call will be made
                </p>
              </CardContent>
            </Card>

            {/* Voice Recording */}
            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mic className="w-6 h-6 text-purple-600" />
                  <span>Voice Recording</span>
                </CardTitle>
                <CardDescription>Record your voice and test AI transcription</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-8 space-y-6">
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                    isRecording 
                      ? 'bg-gradient-to-br from-red-400 to-red-600 animate-pulse shadow-lg shadow-red-300' 
                      : 'bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg'
                  }`}>
                    <Mic className="w-16 h-16 text-white" />
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-2">
                      {isRecording ? 'Recording...' : audioURL ? 'Recording Complete' : 'Ready to Record'}
                    </h3>
                    <p className="text-muted-foreground">
                      {isRecording 
                        ? 'Speak clearly about your incident' 
                        : audioURL 
                        ? `Play your recording or record again (${(audioBlobSize / 1024).toFixed(1)} KB)`
                        : 'Click Start to begin recording'}
                    </p>
                  </div>
                  
                  {/* Hidden audio element for playback */}
                  <audio ref={audioElementRef} className="hidden" />

                  <div className="flex space-x-3">
                    {!isRecording && !audioURL && (
                      <Button
                        size="lg"
                        onClick={startRecording}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 px-8"
                      >
                        <Mic className="w-5 h-5 mr-2" />
                        Start Recording
                      </Button>
                    )}
                    
                    {isRecording && (
                      <Button
                        size="lg"
                        onClick={stopRecording}
                        className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 px-8"
                      >
                        <Square className="w-5 h-5 mr-2" />
                        Stop Recording
                      </Button>
                    )}
                    
                    {audioURL && !isRecording && (
                      <>
                        <Button
                          size="lg"
                          onClick={playRecording}
                          disabled={isPlaying}
                          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 px-8"
                        >
                          <Play className="w-5 h-5 mr-2" />
                          {isPlaying ? 'Playing...' : 'Play Recording'}
                        </Button>
                        <Button
                          size="lg"
                          onClick={() => {
                            setAudioURL(null)
                            setTranscript('')
                            setSummary(null)
                          }}
                          variant="outline"
                          className="px-8"
                        >
                          Record Again
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {transcript && (
              <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    <span>Call Transcript</span>
                  </CardTitle>
                  <CardDescription>Real-time transcription with PII redaction</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-white p-4 rounded-lg border border-green-200 font-mono text-sm whitespace-pre-wrap">
                    {transcript}
                  </div>
                </CardContent>
              </Card>
            )}

            {summary && (
              <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span>AI Summary (Post-Call Analysis)</span>
                  </CardTitle>
                  <CardDescription>Generated by Amazon Bedrock Claude</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Incident Type</p>
                      <Badge className="bg-gradient-to-r from-blue-600 to-blue-700">{summary.incidentType}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Urgency</p>
                      <Badge className="bg-gradient-to-r from-red-600 to-red-700">{summary.urgency}</Badge>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-semibold mb-2 text-blue-900">📍 Location</p>
                    <p className="text-sm">{summary.location}</p>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <p className="text-sm font-semibold mb-2 text-green-900">✓ Action Items</p>
                    <ul className="space-y-1">
                      {summary.actionItems.map((item: string, i: number) => (
                        <li key={i} className="text-sm flex items-start">
                          <span className="text-green-600 mr-2">✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                    <p className="text-sm font-semibold mb-2 text-purple-900">😊 Sentiment Analysis</p>
                    <p className="text-sm">{summary.sentiment}</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-2">🔑 Key Phrases</p>
                    <div className="flex flex-wrap gap-2">
                      {summary.keyPhrases.map((phrase: string, i: number) => (
                        <Badge key={i} variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                          {phrase}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
