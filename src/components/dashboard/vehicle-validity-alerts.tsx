'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { AlertTriangle, Calendar, ShieldCheck, FileText } from 'lucide-react';
import { format, isSameMonth, parseISO } from 'date-fns';

interface Vehicle {
  id: string;
  regNumber: string;
  type: string;
  brandModel: string;
  regValidity: string;
  insuranceValidity: string;
  status: string;
}

export default function VehicleValidityAlerts() {
  const db = useFirestore();
  const { user } = useUser();

  const vehiclesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'vehicles');
  }, [db, user]);

  const { data: vehicles, isLoading } = useCollection<Vehicle>(vehiclesQuery);

  const expiringThisMonth = useMemo(() => {
    if (!vehicles) return [];
    const today = new Date();

    return vehicles.filter(v => {
      const regDate = v.regValidity ? parseISO(v.regValidity) : null;
      const insDate = v.insuranceValidity ? parseISO(v.insuranceValidity) : null;

      const isRegExpiring = regDate ? isSameMonth(regDate, today) : false;
      const isInsExpiring = insDate ? isSameMonth(insDate, today) : false;

      return isRegExpiring || isInsExpiring;
    }).map(v => {
      const regDate = v.regValidity ? parseISO(v.regValidity) : null;
      const insDate = v.insuranceValidity ? parseISO(v.insuranceValidity) : null;
      const today = new Date();

      return {
        ...v,
        regExpiring: regDate ? isSameMonth(regDate, today) : false,
        insExpiring: insDate ? isSameMonth(insDate, today) : false,
      };
    });
  }, [vehicles]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="h-6 w-32 animate-pulse bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-12 w-full animate-pulse bg-muted rounded" />
            <div className="h-12 w-full animate-pulse bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 dark:border-orange-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
          <AlertTriangle className="h-5 w-5" />
          Validity Alerts
        </CardTitle>
        <CardDescription>
          Documents expiring in {format(new Date(), 'MMMM yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {expiringThisMonth.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
              <ShieldCheck className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No vehicles require document updates this month.</p>
            </div>
          ) : (
            expiringThisMonth.map((v) => (
              <div key={v.id} className="flex flex-col gap-2 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{v.regNumber}</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">{v.brandModel}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {v.regExpiring && (
                    <div className="flex items-center gap-2 text-xs font-medium text-orange-600 dark:text-orange-400">
                      <FileText className="h-3.5 w-3.5" />
                      <span>Reg Exp: {format(parseISO(v.regValidity), 'MMM dd')}</span>
                    </div>
                  )}
                  {v.insExpiring && (
                    <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Ins Exp: {format(parseISO(v.insuranceValidity), 'MMM dd')}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
