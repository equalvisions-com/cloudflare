"use client"
import * as z from "zod"
import { formSchema } from '../form-schema'
import { serverAction } from '../actions/server-action'
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { useForm } from "react-hook-form"
import { useAction } from "next-safe-action/hooks"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const initialState = {
  success: false,
  message: "",
}
export function DraftForm() {
  const form = useForm < z.infer < typeof formSchema >> ({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  })
  const doSthAction = useAction(serverAction, {
    onSuccess: () => {
      // TODO: show success message
      form.reset();
    },
    onError: () => {
      // TODO: show error message
    },
  });

  function handleSubmit() {
    form.handleSubmit(doSthAction.execute)
  }
  const isPending = doSthAction.status === "executing"
  return (<div>
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col p-2 md:p-5 w-full mx-auto rounded-md max-w-3xl gap-2 border">
        <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Name</FormLabel> *
                      <FormControl>
                        <Input
                          placeholder=""
                          type={"text"}
                          value={field.value}
                          onChange={(e) => {
                            const val = e.target.value;
                            field.onChange(val);
                          }}
                        />
                      </FormControl>
                      
                      <FormMessage />
                  </FormItem>
                  )
                }
              />
<FormField
                control={form.control}
                name="E-mail"
                render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>E-mail</FormLabel> *
                      <FormControl>
                        <Input
                          placeholder=""
                          type={"email"}
                          value={field.value}
                          onChange={(e) => {
                            const val = e.target.value;
                            field.onChange(val);
                          }}
                        />
                      </FormControl>
                      
                      <FormMessage />
                  </FormItem>
                  )
                }
              />

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => {
          const options = [{"value":"spam/promo","label":"Spam or promotional content"},{"value":"inappropriate/harmful","label":"Inappropriate or harmful content"},{"value":"intellectual","label":"Intellectual property"},{"value":"other","label":"Other (explain)"}];
          return (
            <FormItem className="w-full">
              <FormLabel>Select a reason</FormLabel> *
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder=" " />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {options.map(({ label, value }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
                
              <FormMessage />
            </FormItem>
          )}}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Please provide more details about this issue</FormLabel> *
              <FormControl>
                <Textarea
                  {...field}
                  placeholder=""
                  className="resize-none"
                />
              </FormControl>
              
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end items-center w-full pt-3">
          <Button className="rounded-lg" size="sm">
            {isPending ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </form>
    </Form>
  </div>)
}


---

npx i react-hook-form zod @hookform/resolvers motion


---

pnpm add shadcn@latest add input select textarea

---

import * as z from "zod"

export interface ActionResponse < T = any > {
  success: boolean
  message: string
  errors ? : {
    [K in keyof T] ? : string[]
  }
  inputs ? : T
}
export const formSchema = z.object({
  "name": z.string(),
  "E-mail": z.email(),
  "reason": z.string(),
  "description": z.string()
});

---

"use server";
import { actionClient } from "./safe-action";
import { formSchema } from "../form-schema";

export const serverAction = actionClient.inputSchema(formSchema).action(async ({
  parsedInput
}) => {
  // do something with the data
  console.log(parsedInput)
  return {
    success: true,
    message: 'Form submitted successfully',
  };
});

---

import { createSafeActionClient } from "next-safe-action";

// Create the client with default options.
export const actionClient = createSafeActionClient();