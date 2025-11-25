'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock } from 'lucide-react'

type AdminPinDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onVerify: (pin: string) => Promise<boolean>
  title?: string
  description?: string
}

export function AdminPinDialog({
  open,
  onOpenChange,
  onVerify,
  title = 'Administrator Verification Required',
  description = 'Please enter administrator PIN to proceed with this action.',
}: AdminPinDialogProps) {
  const [pin, setPin] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async () => {
    if (!pin) {
      setError('Please enter PIN')
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      const isValid = await onVerify(pin)
      if (isValid) {
        setPin('')
        // Let parent component handle closing the dialog
      } else {
        setError('Invalid PIN. Please try again.')
      }
    } catch (err) {
      setError('Verification failed. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleCancel = () => {
    setPin('')
    setError('')
    onOpenChange(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleVerify()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-orange-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="admin-pin">Administrator PIN</Label>
            <Input
              id="admin-pin"
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value)
                setError('')
              }}
              onKeyPress={handleKeyPress}
              autoFocus
              disabled={isVerifying}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isVerifying}>
            Cancel
          </Button>
          <Button onClick={handleVerify} disabled={isVerifying || !pin}>
            {isVerifying ? 'Verifying...' : 'Verify'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
