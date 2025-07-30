import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ProcessedData } from '@/types';

interface DetalhamentoPendentesModalProps {
  isOpen: boolean;
  onClose: () => void;
  atividadesPendentes: ProcessedData[];
}

export const DetalhamentoPendentesModal: React.FC<DetalhamentoPendentesModalProps> = ({
  isOpen,
  onClose,
  atividadesPendentes,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Atividades Pendentes Detalhadas</DialogTitle>
          <DialogDescription>
            Lista de atividades pendentes para o período e filtros selecionados no relatório.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto py-4">
          {atividadesPendentes && atividadesPendentes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Atividade</TableHead>
                  <TableHead className="w-[30%]">Disciplina</TableHead>
                  <TableHead className="w-[30%]">Docente Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atividadesPendentes.map((item, index) => (
                  <TableRow key={`${item.Disciplina}-${item.Atividade}-${index}-${item.Docente}`}> {/* Chave mais robusta ainda */}
                    <TableCell className="font-medium truncate" title={item.Atividade}>{item.Atividade}</TableCell>
                    <TableCell className="truncate" title={item.Disciplina}>{item.Disciplina}</TableCell>
                    <TableCell className="truncate" title={item.Docente}>{item.Docente}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-slate-500 dark:text-gray-400 py-8">
              Nenhuma atividade pendente encontrada para os filtros selecionados.
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
